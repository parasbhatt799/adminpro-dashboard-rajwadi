import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Smartphone,
  ArrowLeft,
  ChevronRight,
  Search,
  Wallet,
  Clock,
  Printer,
  Sparkles,
  Zap,
  Info,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '../../context/ToastContext';

interface OperatorInfo {
  billerId: string;
  billerName: string;
  category: string;
}

interface PlanInfo {
  planName?: string;
  amount: number;
  validity?: string;
  description?: string;
}

const CIRCLES = [
  'Andhra Pradesh', 'Assam', 'Bihar & Jharkhand', 'Chennai', 'Delhi', 'Gujarat', 
  'Haryana', 'Himachal Pradesh', 'J&K', 'Karnataka', 'Kerala', 
  'Kolkata', 'Madhya Pradesh', 'Maharashtra', 'Mumbai', 'NorthEast', 
  'Orissa', 'Punjab', 'Rajasthan', 'Tamilnadu', 'Uttar Pradesh (East)', 'Uttar Pradesh (West)', 'West Bengal & AN Island', 'Uttaranchal'
];

export default function UserRecharge({ userId }: { userId: string }) {
  const toast = useToast();

  // Profile / Balance / Slabs
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [slabs, setSlabs] = useState<any[]>([]);

  // TPIN Verification State
  const [dbTpinValue, setDbTpinValue] = useState<string | null>(null);
  const [tpinAttempts, setTpinAttempts] = useState<number>(0);
  const [tpinLockedUntil, setTpinLockedUntil] = useState<string | null>(null);
  const [showTpinModal, setShowTpinModal] = useState<boolean>(false);
  const [tpinInput, setTpinInput] = useState<string>('');
  const [showTpinDigits, setShowTpinDigits] = useState<boolean>(false);
  const [tpinError, setTpinError] = useState<string | null>(null);
  const [tpinLoading, setTpinLoading] = useState<boolean>(false);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);

  // Recharge State Machine
  // 1: Mobile Input, 2: Select Operator/Circle, 3: Plans / Plan Select, 4: Receipt
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [mobileNumber, setMobileNumber] = useState<string>('');
  const [operators, setOperators] = useState<OperatorInfo[]>([]);
  
  // Selected Operator & Circle
  const [selectedOperator, setSelectedOperator] = useState<OperatorInfo | null>(null);
  const [selectedCircle, setSelectedCircle] = useState<string>('Gujarat');

  // Plans Browse
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [filteredPlans, setFilteredPlans] = useState<PlanInfo[]>([]);
  const [searchPlanQuery, setSearchPlanQuery] = useState<string>('');
  const [planLoading, setPlanLoading] = useState<boolean>(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanInfo | null>(null);
  const [manualAmount, setManualAmount] = useState<string>('');

  // Receipt Output
  const [receipt, setReceipt] = useState<any | null>(null);

  // Service Status
  const [isRechargeEnabled, setIsRechargeEnabled] = useState<boolean>(true);

  useEffect(() => {
    fetchProfileData();
    loadOperators();
  }, []);

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          supabase
            .from('users_profiles')
            .update({ tpin_attempts: 0, tpin_locked_until: null })
            .eq('id', userId)
            .then(() => {
              setTpinAttempts(0);
              setTpinLockedUntil(null);
            });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  useEffect(() => {
    if (mobileNumber.length === 10) {
      handleAutoMNP(mobileNumber);
    }
  }, [mobileNumber]);

  useEffect(() => {
    if (!searchPlanQuery.trim()) {
      setFilteredPlans(plans);
    } else {
      const q = searchPlanQuery.toLowerCase();
      setFilteredPlans(plans.filter(p => 
        (p.description || '').toLowerCase().includes(q) || 
        String(p.amount).includes(q) || 
        (p.planName || '').toLowerCase().includes(q)
      ));
    }
  }, [searchPlanQuery, plans]);

  const fetchProfileData = async () => {
    try {
      // Fetch toggle setting
      const { data: settingsData } = await supabase
        .from('qr_settings')
        .select('is_recharge_enabled')
        .eq('id', 1)
        .single();
      if (settingsData) {
        setIsRechargeEnabled(settingsData.is_recharge_enabled ?? true);
      }

      const { data, error } = await supabase
        .from('users_profiles')
        .select('wallet_balance, service_charge_enabled, custom_service_charge, tpin, tpin_attempts, tpin_locked_until, mobile_number')
        .eq('id', userId)
        .single();
      if (!error && data) {
        setWalletBalance(Number(data.wallet_balance) || 0);
        setUserProfile(data);
        setDbTpinValue(data.tpin || null);
        setTpinAttempts(Number(data.tpin_attempts) || 0);

        const lockedUntil = data.tpin_locked_until ? new Date(data.tpin_locked_until).getTime() : 0;
        const now = Date.now();
        if (lockedUntil > now) {
          setLockoutSeconds(Math.ceil((lockedUntil - now) / 1000));
        }
      }

      // Slabs
      const { data: slabData } = await supabase
        .from('service_charge_slabs')
        .select('*')
        .eq('is_active', true)
        .order('min_amount', { ascending: true });
      if (slabData) setSlabs(slabData);
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  };

  const loadOperators = async () => {
    try {
      const res = await fetch('/api/recharge/operators');
      const data = await res.json();
      setOperators(data.operators || []);
    } catch (err) {
      toast.error('Failed to load operator list.');
    }
  };

  const handleAutoMNP = async (num: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/recharge/mnp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: num })
      });
      const data = await res.json();
      if (data.operator) {
        const matchingOp = operators.find(op => op.billerName.toLowerCase().includes(data.operator.toLowerCase())) || null;
        setSelectedOperator(matchingOp);
        setSelectedCircle(data.circle || 'Gujarat');
        toast.info(`Auto-detected: ${data.operator} (${data.circle})`);
        setStep(2);
      }
    } catch (err) {
      console.warn('Auto MNP failed:', err);
      setStep(2); // Fallback to manual selection
    } finally {
      setLoading(false);
    }
  };

  const loadPlans = async () => {
    if (!selectedOperator) return;
    setPlanLoading(true);
    setStep(3);
    setPlans([]);
    setSelectedPlan(null);

    try {
      const res = await fetch(`/api/recharge/plans?billerId=${selectedOperator.billerId}&operator=${selectedOperator.billerName}&circle=${selectedCircle}&mobile=${mobileNumber}`);
      const data = await res.json();
      const list = data?.planMdmResponse?.planList?.plan || [];
      const plansArray = Array.isArray(list) ? list : [list];
      setPlans(plansArray);
      setFilteredPlans(plansArray);
    } catch (err) {
      toast.error('Failed to load recharge plans.');
    } finally {
      setPlanLoading(false);
    }
  };

  const calculateServiceCharge = (amount: number) => {
    if (!userProfile) return 0;
    if (userProfile.service_charge_enabled) {
      return Number(userProfile.custom_service_charge) || 0;
    }
    const slab = slabs.find(s => amount >= s.min_amount && amount <= s.max_amount);
    if (slab) {
      return slab.is_percentage ? (amount * slab.charge_amount) / 100 : slab.charge_amount;
    }
    return 0;
  };

  const handleRechargeTrigger = () => {
    const amt = selectedPlan ? selectedPlan.amount : Number(manualAmount);
    if (!amt || isNaN(amt) || amt <= 0) {
      toast.error('Please specify a valid recharge amount.');
      return;
    }

    if (!dbTpinValue) {
      toast.error('Please configure your TPIN in security panel before transactions.');
      return;
    }

    if (lockoutSeconds > 0) {
      toast.error(`TPIN locked. Please try again in ${Math.ceil(lockoutSeconds / 60)} minutes.`);
      return;
    }

    const serviceCharge = calculateServiceCharge(amt);
    const totalDeduction = amt + serviceCharge;

    if (walletBalance - totalDeduction < 250) {
      toast.error(`Insufficient balance. You must retain at least ₹250 in your wallet after transaction (Total deduction: ₹${totalDeduction.toFixed(2)})`);
      return;
    }

    setTpinInput('');
    setTpinError(null);
    setShowTpinModal(true);
  };

  const handleTpinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tpinInput.length !== 4) {
      setTpinError('TPIN must be 4 digits.');
      return;
    }

    setTpinLoading(true);
    setTpinError(null);

    try {
      const { data: profile } = await supabase
        .from('users_profiles')
        .select('tpin, tpin_attempts, tpin_locked_until')
        .eq('id', userId)
        .single();

      if (!profile) throw new Error('Verification failed.');

      const now = Date.now();
      const lockedUntil = profile.tpin_locked_until ? new Date(profile.tpin_locked_until).getTime() : 0;
      if (lockedUntil > now) {
        setLockoutSeconds(Math.ceil((lockedUntil - now) / 1000));
        setShowTpinModal(false);
        throw new Error('TPIN is locked.');
      }

      if (profile.tpin !== tpinInput) {
        const attempts = (profile.tpin_attempts || 0) + 1;
        if (attempts >= 3) {
          const lockTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();
          await supabase
            .from('users_profiles')
            .update({ tpin_attempts: attempts, tpin_locked_until: lockTime })
            .eq('id', userId);
          setLockoutSeconds(600);
          setShowTpinModal(false);
          toast.error('Too many incorrect TPIN attempts. Account locked for 10 minutes.');
        } else {
          await supabase
            .from('users_profiles')
            .update({ tpin_attempts: attempts })
            .eq('id', userId);
          setTpinError(`Incorrect TPIN. ${3 - attempts} attempts remaining.`);
        }
      } else {
        await supabase
            .from('users_profiles')
            .update({ tpin_attempts: 0, tpin_locked_until: null })
            .eq('id', userId);
        setShowTpinModal(false);
        executeRecharge();
      }
    } catch (err: any) {
      toast.error(err.message || 'TPIN verification failed.');
    } finally {
      setTpinLoading(false);
    }
  };

  const executeRecharge = async () => {
    if (!selectedOperator) return;
    setLoading(true);

    const amt = selectedPlan ? selectedPlan.amount : Number(manualAmount);

    try {
      const res = await fetch('/api/recharge/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          mobile: mobileNumber,
          billerId: selectedOperator.billerId,
          operator: selectedOperator.billerName,
          circle: selectedCircle,
          amount: amt,
          planId: selectedPlan ? 'Selected' : 'Manual'
        })
      });

      const data = await res.json();

      if (data.status === 'SUCCESS') {
        toast.success('Mobile Recharge Successful!');
        setReceipt({
          txnid: data.data?.txnRefId || `TXN${Math.floor(100000 + Math.random() * 900000)}`,
          mobile: mobileNumber,
          amount: amt,
          charges: data.charges || 0,
          operator: selectedOperator.billerName,
          date: new Date().toLocaleString()
        });
        setWalletBalance(data.new_balance);
        setStep(4);
      } else {
        toast.error(data.message || 'Recharge failed.');
      }
    } catch (err) {
      toast.error('Error executing payment transaction.');
    } finally {
      setLoading(false);
    }
  };

  if (!isRechargeEnabled) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 bg-white rounded-[32px] border border-slate-200 shadow-sm max-w-lg mx-auto mt-12 space-y-4">
        <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 shadow-inner">
          <Smartphone size={32} />
        </div>
        <h3 className="text-xl font-black text-slate-800 tracking-tight">Service Unavailable</h3>
        <p className="text-sm text-slate-400 max-w-xs leading-relaxed">
          The Mobile Recharge service has been temporarily disabled by the administrator. Please try again later.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto p-4">
      {/* Print Receipt CSS */}
      <AnimatePresence>
        {step === 4 && receipt && (
          <style dangerouslySetInnerHTML={{
            __html: `
            @media print {
              body * { visibility: hidden !important; }
              #receipt-print-area, #receipt-print-area * { visibility: visible !important; }
              #receipt-print-area {
                position: absolute !important;
                left: 50% !important;
                top: 0 !important;
                transform: translateX(-50%) !important;
                width: 100% !important;
                max-width: 400px !important;
                border: none !important;
                padding: 0 !important;
                background: white !important;
              }
            }
          `}} />
        )}
      </AnimatePresence>

      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 p-8 rounded-[32px] border border-slate-700/50 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 space-y-2">
          <span className="text-xs bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full font-bold uppercase tracking-widest flex items-center gap-1.5 w-fit">
            <Sparkles size={12} className="animate-pulse" />
            Prepaid Recharge
          </span>
          <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <Smartphone className="text-emerald-400" size={32} />
            Mobile Recharge
          </h2>
          <p className="text-slate-400 max-w-md text-sm leading-relaxed">
            Recharge any prepaid connection instantly with instant validation & secure deductions.
          </p>
        </div>

        <div className="relative z-10 flex gap-4">
          <div className="flex items-center gap-3.5 bg-white/5 backdrop-blur-md px-6 py-4 rounded-3xl border border-white/10 shadow-inner">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400 shadow-md">
              <Wallet size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Available Balance</p>
              <p className="text-xl font-black text-white">₹{walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Wizard Card */}
      <div className="bg-white rounded-[36px] border border-slate-200 shadow-md overflow-hidden min-h-[450px]">
        {/* Step Header */}
        <div className="bg-slate-50 border-b border-slate-100 px-8 py-4 flex items-center gap-3">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
            Step {step} of 4: {
              step === 1 ? 'Enter Phone Number' :
              step === 2 ? 'Select Operator & Circle' :
              step === 3 ? 'Browse Plans' :
              'Receipt generated'
            }
          </span>
        </div>

        <div className="p-8">
          {/* Step 1: Mobile Input */}
          {step === 1 && (
            <div className="max-w-md mx-auto py-12 space-y-6">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-3xl flex items-center justify-center mx-auto text-emerald-600 shadow-sm">
                  <Smartphone size={32} />
                </div>
                <h3 className="text-lg font-black text-slate-800">Enter Mobile Number</h3>
                <p className="text-xs text-slate-400">Recharge plans will be fetched automatically.</p>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-6 pr-12 py-4 rounded-2xl border border-slate-200 outline-none text-sm font-semibold text-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all bg-white"
                    placeholder="Enter 10-digit mobile number"
                  />
                  {loading && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 border-2 border-slate-200 border-t-emerald-600 rounded-full animate-spin"></div>
                  )}
                </div>

                <button
                  onClick={() => mobileNumber.length === 10 ? handleAutoMNP(mobileNumber) : toast.error('Enter a valid 10-digit mobile number.')}
                  disabled={loading || mobileNumber.length !== 10}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-md shadow-emerald-100 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  Proceed
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Operator & Circle selection */}
          {step === 2 && (
            <div className="max-w-md mx-auto py-8 space-y-6">
              <h3 className="text-lg font-black text-slate-800 text-center">Select Operator & Circle</h3>
              
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Operator</label>
                  <select
                    value={selectedOperator?.billerId || ''}
                    onChange={(e) => setSelectedOperator(operators.find(op => op.billerId === e.target.value) || null)}
                    className="w-full px-4 py-3 bg-slate-50 rounded-2xl border border-slate-200 outline-none text-xs font-semibold text-slate-700 focus:bg-white focus:border-emerald-500 transition-all"
                  >
                    <option value="" disabled>Choose Operator</option>
                    {operators.map((op, idx) => (
                      <option key={idx} value={op.billerId}>{op.billerName}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Telecom Circle</label>
                  <select
                    value={selectedCircle}
                    onChange={(e) => setSelectedCircle(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 rounded-2xl border border-slate-200 outline-none text-xs font-semibold text-slate-700 focus:bg-white focus:border-emerald-500 transition-all"
                  >
                    {CIRCLES.map((c, idx) => (
                      <option key={idx} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={loadPlans}
                  disabled={!selectedOperator}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-md shadow-emerald-100 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  View Plans
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Browse Plans */}
          {step === 3 && selectedOperator && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Plans list */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Browse Plans</h3>
                  <div className="relative w-48 sm:w-64">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search plans..."
                      value={searchPlanQuery}
                      onChange={(e) => setSearchPlanQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-slate-50 rounded-xl border border-slate-200 outline-none text-xs font-semibold text-slate-700 focus:bg-white focus:border-emerald-500 transition-all"
                    />
                  </div>
                </div>

                <div className="max-h-[400px] overflow-y-auto space-y-3 pr-2 no-scrollbar border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
                  {planLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                      <div className="w-8 h-8 border-4 border-slate-100 border-t-emerald-600 rounded-full animate-spin"></div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Fetching plans...</p>
                    </div>
                  ) : filteredPlans.length === 0 ? (
                    <div className="text-center py-16 text-slate-400 space-y-2">
                      <Info size={24} className="mx-auto text-slate-300" />
                      <p className="text-xs font-bold">No Plans Available</p>
                      <p className="text-[11px]">Specify manual recharge amount in the summary block.</p>
                    </div>
                  ) : (
                    filteredPlans.map((plan, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setSelectedPlan(plan);
                          setManualAmount(plan.amount.toString());
                        }}
                        className={`p-4 rounded-xl border transition-all cursor-pointer flex justify-between items-center ${
                          selectedPlan === plan ? 'bg-emerald-50/50 border-emerald-500 shadow-sm' : 'bg-white border-slate-200/60 hover:bg-slate-50'
                        }`}
                      >
                        <div className="space-y-1 pr-4">
                          <p className="text-xs font-black text-slate-800">
                            ₹{plan.amount} <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded font-bold">{plan.validity || 'N/A'}</span>
                          </p>
                          <p className="text-[11px] text-slate-500 leading-normal">{plan.description}</p>
                        </div>
                        <ChevronRight size={16} className={selectedPlan === plan ? 'text-emerald-600' : 'text-slate-400'} />
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Summary card */}
              <div className="lg:col-span-5 border-t lg:border-t-0 lg:border-l border-slate-100 lg:pl-8 pt-8 lg:pt-0">
                <div className="space-y-6">
                  <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">Recharge Summary</h3>

                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-slate-400 uppercase">Mobile Number</span>
                      <span className="text-xs font-black text-slate-800 font-mono">{mobileNumber}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-slate-400 uppercase">Operator</span>
                      <span className="text-xs font-black text-slate-800">{selectedOperator.billerName}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-slate-400 uppercase">Circle</span>
                      <span className="text-xs font-black text-slate-800">{selectedCircle}</span>
                    </div>
                  </div>

                  {/* Manual Amount input if no plan is chosen */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase">Recharge Amount (₹)</label>
                    <input
                      type="number"
                      value={manualAmount}
                      onChange={(e) => {
                        setSelectedPlan(null);
                        setManualAmount(e.target.value);
                      }}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none text-xs font-black text-slate-800 focus:border-emerald-500 transition-all bg-white"
                      placeholder="Enter amount manually"
                    />
                  </div>

                  {/* Charge Breakdown */}
                  {manualAmount && (
                    <div className="p-5 bg-emerald-50/20 border border-emerald-100 rounded-3xl space-y-3">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Base Amount</span>
                        <span className="font-bold text-slate-800">₹{Number(manualAmount).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Service Charges</span>
                        <span className="font-bold text-rose-500">₹{calculateServiceCharge(Number(manualAmount)).toFixed(2)}</span>
                      </div>
                      <div className="w-full h-px bg-slate-200 my-1"></div>
                      <div className="flex justify-between text-xs font-black text-slate-900">
                        <span>Total Deducted</span>
                        <span>₹{(Number(manualAmount) + calculateServiceCharge(Number(manualAmount))).toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleRechargeTrigger}
                    disabled={loading || !manualAmount}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-md shadow-emerald-100 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    Proceed to Pay
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Receipt */}
          {step === 4 && receipt && (
            <div className="max-w-md mx-auto py-6" id="receipt-print-area">
              <div className="bg-slate-50 p-8 rounded-3xl border border-slate-200 space-y-6 text-center">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle2 size={28} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">Recharge Successful</h3>
                  <p className="text-[11px] text-slate-400 mt-1">Transaction Ref: {receipt.txnid}</p>
                </div>

                <div className="border-t border-dashed border-slate-300 pt-6 space-y-3 text-left">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400 font-bold uppercase">Phone Number</span>
                    <span className="font-mono font-black text-slate-800">{receipt.mobile}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400 font-bold uppercase">Operator</span>
                    <span className="font-black text-slate-800">{receipt.operator}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400 font-bold uppercase">Amount Paid</span>
                    <span className="font-black text-slate-800">₹{receipt.amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400 font-bold uppercase">Service Charge</span>
                    <span className="font-black text-slate-800">₹{receipt.charges.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400 font-bold uppercase">Date & Time</span>
                    <span className="font-black text-slate-800">{receipt.date}</span>
                  </div>
                </div>

                <div className="flex gap-4 pt-4 print:hidden">
                  <button
                    onClick={() => setStep(1)}
                    className="flex-1 py-3.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-2xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer"
                  >
                    New Recharge
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-md shadow-emerald-100 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Printer size={15} />
                    Receipt
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* TPIN Modal */}
      <AnimatePresence>
        {showTpinModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-white rounded-[32px] p-8 border border-slate-200 shadow-2xl relative overflow-hidden"
            >
              <div className="text-center space-y-4">
                <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mx-auto text-emerald-600 shadow-sm">
                  <Lock size={20} />
                </div>
                <div>
                  <h4 className="font-black text-slate-800">Enter Security TPIN</h4>
                  <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-bold">Please verify TPIN to complete recharge</p>
                </div>

                <form onSubmit={handleTpinSubmit} className="space-y-4 pt-2">
                  <div className="relative max-w-[180px] mx-auto">
                    <input
                      type={showTpinDigits ? 'text' : 'password'}
                      maxLength={4}
                      required
                      value={tpinInput}
                      onChange={(e) => setTpinInput(e.target.value.replace(/\D/g, ''))}
                      className="w-full text-center tracking-[1.5em] pl-4 py-3.5 text-lg font-black bg-slate-50 rounded-2xl border border-slate-200 outline-none focus:border-emerald-500 transition-all font-mono"
                      placeholder="••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowTpinDigits(!showTpinDigits)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showTpinDigits ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {tpinError && (
                    <p className="text-xs text-rose-500 font-bold leading-normal">{tpinError}</p>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowTpinModal(false)}
                      className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={tpinLoading || tpinInput.length !== 4}
                      className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {tpinLoading ? 'Verifying...' : 'Pay Now'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
