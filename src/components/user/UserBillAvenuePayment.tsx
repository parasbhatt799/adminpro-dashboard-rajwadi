import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  Receipt,
  Search,
  ArrowLeft,
  CheckCircle2,
  X,
  AlertTriangle,
  Lightbulb,
  Tv,
  Smartphone,
  Wifi,
  Flame,
  Droplets,
  HelpCircle,
  Clock,
  Wallet,
  Printer,
  ChevronRight,
  ShieldCheck,
  Tag,
  CreditCard,
  Lock,
  Eye,
  EyeOff,
  User,
  MessageSquare,
  Sparkles,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '../../context/ToastContext';

interface BillerInputParam {
  paramName: string;
  dataType: string;
  optional?: boolean;
}

interface BillerInfo {
  billerId: string;
  billerName: string;
  categoryName: string;
}

function getCategoryDetails(name: string) {
  const normName = name.toLowerCase();
  
  if (normName.includes('mobile prepaid') || normName.includes('prepaid mobile')) {
    return {
      icon: Smartphone,
      gradient: 'from-emerald-400 to-teal-600',
      desc: 'Recharge any prepaid connection'
    };
  }
  if (normName.includes('mobile postpaid') || normName.includes('postpaid mobile')) {
    return {
      icon: Smartphone,
      gradient: 'from-blue-400 to-indigo-600',
      desc: 'Pay postpaid mobile bills'
    };
  }
  if (normName.includes('credit card')) {
    return {
      icon: CreditCard,
      gradient: 'from-pink-400 to-rose-600',
      desc: 'Pay credit card bills instantly'
    };
  }
  if (normName.includes('electricity')) {
    return {
      icon: Lightbulb,
      gradient: 'from-amber-400 to-orange-500',
      desc: 'Pay state power bills'
    };
  }
  if (normName.includes('gas') || normName.includes('lpg')) {
    return {
      icon: Flame,
      gradient: 'from-red-400 to-rose-600',
      desc: 'Piped gas & cylinder booking'
    };
  }
  if (normName.includes('water')) {
    return {
      icon: Droplets,
      gradient: 'from-cyan-400 to-blue-600',
      desc: 'Pay municipal water bills'
    };
  }
  if (normName.includes('broadband') || normName.includes('landline')) {
    return {
      icon: Wifi,
      gradient: 'from-purple-400 to-pink-600',
      desc: 'High-speed internet or landline bills'
    };
  }
  if (normName.includes('dth') || normName.includes('cable')) {
    return {
      icon: Tv,
      gradient: 'from-sky-400 to-blue-500',
      desc: 'Recharge your DTH or cable TV subscription'
    };
  }
  if (normName.includes('loan') || normName.includes('emi')) {
    return {
      icon: Receipt,
      gradient: 'from-violet-400 to-fuchsia-600',
      desc: 'Repay active bank loans & EMIs'
    };
  }
  if (normName.includes('insurance')) {
    return {
      icon: ShieldCheck,
      gradient: 'from-teal-400 to-emerald-600',
      desc: 'Pay life, health or vehicle insurance premiums'
    };
  }
  if (normName.includes('fastag')) {
    return {
      icon: Tag,
      gradient: 'from-amber-500 to-yellow-600',
      desc: 'Recharge your FASTag toll account'
    };
  }

  // Fallback
  return {
    icon: Receipt,
    gradient: 'from-slate-400 to-slate-600',
    desc: `Pay your ${name} bills online`
  };
}

const STANDARD_CATEGORIES = [
  { name: 'Mobile Postpaid', icon: Smartphone, gradient: 'from-blue-400 to-indigo-600', desc: 'Pay postpaid mobile bills' },
  { name: 'Credit Card', icon: CreditCard, gradient: 'from-pink-400 to-rose-600', desc: 'Pay credit card bills instantly' },
  { name: 'Electricity', icon: Lightbulb, gradient: 'from-amber-400 to-orange-500', desc: 'Pay state power bills' },
  { name: 'Gas', icon: Flame, gradient: 'from-red-400 to-rose-600', desc: 'Piped gas & cylinder booking' },
  { name: 'Water', icon: Droplets, gradient: 'from-cyan-400 to-blue-600', desc: 'Pay municipal water bills' },
  { name: 'Broadband', icon: Wifi, gradient: 'from-purple-400 to-pink-600', desc: 'High-speed internet recharges' },
  { name: 'DTH', icon: Tv, gradient: 'from-sky-400 to-blue-500', desc: 'Recharge DTH connection' },
  { name: 'Cable TV', icon: Tv, gradient: 'from-teal-400 to-cyan-500', desc: 'Pay Cable TV operator bills' },
  { name: 'Loan Repayment', icon: Receipt, gradient: 'from-violet-400 to-fuchsia-600', desc: 'Repay active bank loans & EMIs' },
  { name: 'Insurance', icon: ShieldCheck, gradient: 'from-teal-400 to-emerald-600', desc: 'Pay life, health or vehicle insurance' },
  { name: 'FASTag', icon: Tag, gradient: 'from-amber-500 to-yellow-600', desc: 'Recharge FASTag toll account' },
  { name: 'Education Fees', icon: HelpCircle, gradient: 'from-violet-500 to-purple-600', desc: 'Pay school, college or coaching fees' },
  { name: 'Municipal Taxes', icon: Receipt, gradient: 'from-slate-500 to-slate-700', desc: 'Pay municipal property tax' },
  { name: 'Housing Society', icon: HelpCircle, gradient: 'from-rose-400 to-pink-500', desc: 'Pay maintenance or society charges' },
  { name: 'Subscription', icon: Sparkles, gradient: 'from-yellow-400 to-amber-500', desc: 'Pay platform subscription fees' },
  { name: 'Hospital', icon: HelpCircle, gradient: 'from-red-500 to-rose-600', desc: 'Pay hospital & clinic bills' }
];

export default function UserBillAvenuePayment({ userId }: { userId: string }) {
  const toast = useToast();
  const navigate = useNavigate();

  // Wallet & Profile State
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [slabs, setSlabs] = useState<any[]>([]);

  // CCF1 Convenience Fee Configuration
  const [ccf1Config, setCcf1Config] = useState<{ flatFee: number; percentFee: number } | null>(null);
  const [ccf1Fee, setCcf1Fee] = useState<number>(0); // in Rupees

  // TPIN & Lockout
  const [dbTpinValue, setDbTpinValue] = useState<string | null>(null);
  const [tpinAttempts, setTpinAttempts] = useState<number>(0);
  const [tpinLockedUntil, setTpinLockedUntil] = useState<string | null>(null);
  const [showTpinModal, setShowTpinModal] = useState<boolean>(false);
  const [tpinInput, setTpinInput] = useState<string>('');
  const [showTpinDigits, setShowTpinDigits] = useState<boolean>(false);
  const [tpinError, setTpinError] = useState<string | null>(null);
  const [tpinLoading, setTpinLoading] = useState<boolean>(false);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);

  // Workflow steps: 1: Categories, 2: Billers, 3: Inputs, 4: Receipt/Status
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [allBillers, setAllBillers] = useState<BillerInfo[]>([]);
  const [categories, setCategories] = useState<{ name: string; icon: any; gradient: string; desc: string }[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState<boolean>(true);
  const [billers, setBillers] = useState<BillerInfo[]>([]);
  const [filteredBillers, setFilteredBillers] = useState<BillerInfo[]>([]);
  const [searchBillerQuery, setSearchBillerQuery] = useState<string>('');
  const [selectedBiller, setSelectedBiller] = useState<BillerInfo | null>(null);

  // Form parameters
  const [inputParams, setInputParams] = useState<BillerInputParam[]>([]);
  const [formInputs, setFormInputs] = useState<Record<string, string>>({});
  const [customerMobile, setCustomerMobile] = useState<string>('');
  const [manualAmount, setManualAmount] = useState<string>('');

  // Plans (for Mobile Prepaid)
  const [plans, setPlans] = useState<any[]>([]);
  const [planLoading, setPlanLoading] = useState<boolean>(false);
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);

  // Fetched bill details
  const [billDetails, setBillDetails] = useState<{
    customerName: string;
    billAmount: number;
    dueDate?: string;
    billNumber?: string;
    billDate?: string;
    billPeriod?: string;
    additionalInfo?: { infoName: string; infoValue: string }[];
    fetchSupported: boolean;
  } | null>(null);

  // Receipt State
  const [receipt, setReceipt] = useState<any | null>(null);

  // Removed complaints states as they are now on a dedicated page

  useEffect(() => {
    fetchProfileData();
    fetchBillersAndCategories();
  }, []);

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          // Unlock on database
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
    if (!searchBillerQuery.trim()) {
      setFilteredBillers(billers);
    } else {
      const q = searchBillerQuery.toLowerCase();
      setFilteredBillers(billers.filter(b => b.billerName.toLowerCase().includes(q)));
    }
  }, [searchBillerQuery, billers]);

  useEffect(() => {
    const amt = selectedPlan ? Number(selectedPlan.amount) : Number(manualAmount);
    if (ccf1Config && amt > 0) {
      const amtInPaisa = Math.round(amt * 100);
      const baseCcf1 = (amtInPaisa * ccf1Config.percentFee / 100) + ccf1Config.flatFee;
      const gst = baseCcf1 * 0.18;
      const totalCcf1InPaisa = Math.floor(baseCcf1 + gst);
      setCcf1Fee(totalCcf1InPaisa / 100);
    } else {
      setCcf1Fee(0);
    }
  }, [manualAmount, selectedPlan, ccf1Config]);

  const fetchProfileData = async () => {
    try {
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
        setCustomerMobile(data.mobile_number || '');

        const lockedUntil = data.tpin_locked_until ? new Date(data.tpin_locked_until).getTime() : 0;
        const now = Date.now();
        if (lockedUntil > now) {
          setLockoutSeconds(Math.ceil((lockedUntil - now) / 1000));
        }
      }

      // Fetch Slabs
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

  const fetchBillersAndCategories = async () => {
    setCategoriesLoading(true);
    try {
      const res = await fetch(`/api/bbps/billers`);
      const data = await res.json();
      const list = data?.billerInfoResponse?.biller || [];
      const billersArray = Array.isArray(list) ? list : [list];

      const mappedBillers: BillerInfo[] = billersArray.map((b: any) => ({
        billerId: b.billerId,
        billerName: b.billerName,
        categoryName: b.category || 'Other'
      }));

      setAllBillers(mappedBillers);

      // Extract unique categories from the API, filtering out prepaid/recharge
      const apiCategoryNames = Array.from(
        new Set(mappedBillers.map(b => b.categoryName))
      ).filter(Boolean).filter(name => {
        const norm = name.toLowerCase();
        return !norm.includes('prepaid') && !norm.includes('recharge');
      });

      // Start with our comprehensive standard categories list
      const mergedCats = [...STANDARD_CATEGORIES];

      // Add any additional category returned by the API that isn't already present
      apiCategoryNames.forEach(apiCatName => {
        const exists = mergedCats.some(c => c.name.toLowerCase() === apiCatName.toLowerCase());
        if (!exists) {
          const details = getCategoryDetails(apiCatName);
          mergedCats.push({
            name: apiCatName,
            ...details
          });
        }
      });

      // Sort categories alphabetically
      mergedCats.sort((a, b) => a.name.localeCompare(b.name));

      setCategories(mergedCats);
    } catch (err) {
      console.error('Error fetching categories:', err);
      toast.error('Failed to load billers and categories.');
    } finally {
      setCategoriesLoading(false);
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

  // Filter cached billers for selected category in-memory
  const selectCategory = (catName: string) => {
    setSelectedCategory(catName);
    setStep(2);
    setSearchBillerQuery('');

    const filtered = allBillers.filter((b: any) => {
      const catLower = b.categoryName.toLowerCase();
      const searchLower = catName.toLowerCase();
      if (searchLower === 'mobile prepaid') {
        return catLower.includes('mobile prepaid') || catLower.includes('recharge');
      }
      return catLower === searchLower || catLower.includes(searchLower);
    });

    setBillers(filtered);
    setFilteredBillers(filtered);
  };

  // Select Biller and determine input parameters
  const selectBiller = async (biller: BillerInfo) => {
    setSelectedBiller(biller);
    setStep(3);
    setLoading(true);
    setFormInputs({});
    setManualAmount('');
    setBillDetails(null);
    setSelectedPlan(null);
    setPlans([]);
    setCcf1Config(null);
    setCcf1Fee(0);

    try {
      // Fetch details of specific biller to inspect parameters
      const res = await fetch(`/api/bbps/billers?billerId=${biller.billerId}`);
      const data = await res.json();
      const bDetail = data?.billerInfoResponse?.biller;

      const ccf1FeeInfo = bDetail?.interchangeFeeCCF1;
      if (ccf1FeeInfo) {
        setCcf1Config({
          flatFee: Number(ccf1FeeInfo.flatFee) || 0,
          percentFee: Number(ccf1FeeInfo.percentFee) || 0
        });
      } else {
        setCcf1Config(null);
      }

      // Map parameters
      const paramsList: BillerInputParam[] = [];
      const inputParamsData = bDetail?.inputParams?.input || [];
      const inputParamsArray = Array.isArray(inputParamsData) ? inputParamsData : [inputParamsData];

      inputParamsArray.forEach((p: any) => {
        if (p.paramName) {
          paramsList.push({
            paramName: p.paramName,
            dataType: p.dataType || 'ALPHANUMERIC',
            optional: p.optional === 'true' || p.optional === true
          });
        }
      });

      // Default fallback parameter if none returned
      setInputParams(paramsList.length > 0 ? paramsList : [{ paramName: 'Consumer / Subscriber Number', dataType: 'ALPHANUMERIC' }]);

      // If Prepaid Mobile, fetch recharge plans
      if (selectedCategory === 'Mobile Prepaid') {
        fetchRechargePlans(biller.billerId);
      }
    } catch (err) {
      // Fallback parameters
      setInputParams([{ paramName: 'Consumer Number', dataType: 'ALPHANUMERIC' }]);
    } finally {
      setLoading(false);
    }
  };

  const fetchRechargePlans = async (billerId: string) => {
    setPlanLoading(true);
    try {
      const res = await fetch(`/api/bbps/plans?billerId=${billerId}`);
      const data = await res.json();
      const planList = data?.planMdmResponse?.planList?.plan || [];
      setPlans(Array.isArray(planList) ? planList : [planList]);
    } catch (err) {
      console.warn('Plans API failed/unsupported:', err);
    } finally {
      setPlanLoading(false);
    }
  };

  const handleFetchBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBiller) return;

    // Validate inputs
    for (const param of inputParams) {
      if (!param.optional && !formInputs[param.paramName]?.trim()) {
        toast.error(`Please fill in ${param.paramName}`);
        return;
      }
    }

    setLoading(true);
    setBillDetails(null);

    try {
      const res = await fetch('/api/bbps/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billerId: selectedBiller.billerId,
          customerParams: formInputs,
          customerMobile
        })
      });

      const data = await res.json();
      const response = data?.billFetchResponse;

      if (response && (response.responseCode === '0000' || response.status?.toLowerCase() === 'success')) {
        const billAmount = Number(response.billAmount) ? Number(response.billAmount) / 100 : 0; // Convert paise to Rs
        const addInfo = response.additionalInfo?.info || [];
        const additionalInfoArray = Array.isArray(addInfo) ? addInfo : [addInfo].filter((i: any) => i && i.infoName);

        setBillDetails({
          customerName: response.customerName || 'Valued Customer',
          billAmount: billAmount,
          dueDate: response.dueDate,
          billNumber: response.billNumber,
          billDate: response.billDate,
          billPeriod: response.billPeriod,
          additionalInfo: additionalInfoArray,
          fetchSupported: true
        });
        setManualAmount(billAmount.toString());
      } else {
        // Fallback for billers without fetch support (QuickPay / adhoc)
        setBillDetails({
          customerName: 'QuickPay / Adhoc Payment',
          billAmount: 0,
          fetchSupported: false
        });
        toast.info('Biller does not support direct bill fetching. Proceeding with QuickPay manual entry.');
      }
    } catch (err) {
      setBillDetails({
        customerName: 'QuickPay / Adhoc Payment',
        billAmount: 0,
        fetchSupported: false
      });
      toast.info('Unable to fetch bill. Proceeding with manual input.');
    } finally {
      setLoading(false);
    }
  };

  const initiatePayment = () => {
    const amt = selectedPlan ? Number(selectedPlan.amount) : Number(manualAmount);
    if (!amt || isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid amount.');
      return;
    }

    if (!dbTpinValue) {
      toast.error('Please configure your TPIN under the Create TPIN tab before paying.');
      return;
    }

    if (lockoutSeconds > 0) {
      toast.error(`TPIN locked. Please try again in ${Math.ceil(lockoutSeconds / 60)} minutes.`);
      return;
    }

    const serviceCharge = calculateServiceCharge(amt);
    const totalDeduction = amt + serviceCharge + ccf1Fee;

    if (walletBalance - totalDeduction < 250) {
      const feeMsg = ccf1Fee > 0 ? ` + Convenience Fee: ₹${ccf1Fee.toFixed(2)}` : '';
      toast.error(`Insufficient balance. You must maintain at least ₹250 after transaction (Bill Amount: ₹${amt} + Service Charge: ₹${serviceCharge}${feeMsg})`);
      return;
    }

    setTpinInput('');
    setTpinError(null);
    setShowTpinModal(true);
  };

  const handleTpinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tpinInput.length !== 4) {
      setTpinError('Please enter a 4-digit TPIN.');
      return;
    }

    setTpinLoading(true);
    setTpinError(null);

    try {
      // Re-verify profile details to verify lockouts
      const { data: profile } = await supabase
        .from('users_profiles')
        .select('tpin, tpin_attempts, tpin_locked_until')
        .eq('id', userId)
        .single();

      if (!profile) throw new Error('Profile loading error.');

      const now = Date.now();
      const lockedUntil = profile.tpin_locked_until ? new Date(profile.tpin_locked_until).getTime() : 0;
      if (lockedUntil > now) {
        setLockoutSeconds(Math.ceil((lockedUntil - now) / 1000));
        setShowTpinModal(false);
        throw new Error('TPIN is currently locked.');
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
        // Success
        await supabase
          .from('users_profiles')
          .update({ tpin_attempts: 0, tpin_locked_until: null })
          .eq('id', userId);
        setShowTpinModal(false);
        executePayment();
      }
    } catch (err: any) {
      toast.error(err.message || 'TPIN verification failed.');
    } finally {
      setTpinLoading(false);
    }
  };

  const executePayment = async () => {
    if (!selectedBiller) return;
    setLoading(true);

    const amt = selectedPlan ? Number(selectedPlan.amount) : Number(manualAmount);

    try {
      const res = await fetch('/api/bbps/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          billerId: selectedBiller.billerId,
          customerParams: formInputs,
          customerMobile,
          amount: amt,
          paymentMode: 'UPI',
          quickPay: billDetails?.fetchSupported ? 'N' : 'Y',
          ccf1: ccf1Config ? Math.round(ccf1Fee * 100) : undefined
        })
      });

      const data = await res.json();

      if (data.status === 'SUCCESS') {
        toast.success('Bill paid successfully via BillAvenue BBPS!');
        setReceipt({
          txnid: data.data?.txnRefId || `TXN${Math.floor(100000 + Math.random() * 900000)}`,
          amount: amt,
          charges: data.charges || 0,
          ccf1Fee: ccf1Fee,
          billerName: selectedBiller.billerName,
          date: new Date().toLocaleString(),
          consumerDetails: formInputs
        });
        setWalletBalance(data.new_balance);
        setStep(4);
      } else {
        toast.error(data.message || 'Payment execution failed.');
      }
    } catch (err) {
      toast.error('An error occurred during payment processing.');
    } finally {
      setLoading(false);
    }
  };

  // Removed complaint handlers as they are now on a dedicated page

  return (
    <div className="space-y-8 max-w-6xl mx-auto p-4">
      {/* Dynamic Print Receipt Style */}
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

      {/* Header card with current balance */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-8 rounded-[32px] border border-slate-700/50 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 space-y-2">
          <span className="text-xs bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full font-bold uppercase tracking-widest flex items-center gap-1.5 w-fit">
            <Sparkles size={12} className="animate-spin-slow" />
            Secure Gateway
          </span>
          <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <img src="/b_mnemonic.png" alt="B" className="h-8 w-8 object-contain" />
            BBPS PAY BILL
          </h2>
          <p className="text-slate-400 max-w-md text-sm leading-relaxed">
            Securely recharge plans and pay all utility bills instantly with direct NPCI settlement.
          </p>
        </div>

        <div className="relative z-10 flex gap-4">
          <div className="flex items-center gap-3.5 bg-white/5 backdrop-blur-md px-6 py-4 rounded-3xl border border-white/10 shadow-inner">
            <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400 shadow-md">
              <Wallet size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Available Balance</p>
              <p className="text-xl font-black text-white">₹{walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>

          <button
            onClick={() => navigate('/user/bbps-complaints')}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-5 py-4 rounded-3xl border border-slate-700 hover:text-white transition-all text-xs font-bold uppercase tracking-wider"
          >
            <MessageSquare size={16} />
            Complaints
          </button>
        </div>
      </div>

      {/* Main Workflow container */}
      <div className="bg-white rounded-[36px] border border-slate-200 shadow-md overflow-hidden min-h-[500px]">
        {/* Step Header */}
        <div className="bg-slate-50 border-b border-slate-100 px-8 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
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
                step === 1 ? 'Select Utility Service' :
                step === 2 ? `Select ${selectedCategory} Provider` :
                step === 3 ? `Enter Account Details` :
                'Receipt generated'
              }
            </span>
          </div>
          {step < 4 && (
            <img src="/bharat_connect.png" alt="Bharat Connect" className="h-[30px] w-auto object-contain" />
          )}
        </div>

        {/* Step Contents */}
        <div className="p-8">
          {/* Step 1: Categories */}
          {step === 1 && (
            <div className="space-y-6">
              <h3 className="text-lg font-black text-slate-800 tracking-tight">Select a category to begin</h3>
              {categoriesLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="w-10 h-10 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin"></div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Loading categories...</p>
                </div>
              ) : categories.length === 0 ? (
                <div className="text-center py-16 text-slate-400 space-y-2">
                  <Info size={32} className="mx-auto text-slate-300" />
                  <p className="text-xs font-black text-slate-600">No Categories Found</p>
                  <p className="text-[11px]">Could not fetch categories from BillAvenue API.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {categories.map((cat, idx) => {
                    const Icon = cat.icon;
                    return (
                      <button
                        key={idx}
                        onClick={() => selectCategory(cat.name)}
                        className="group flex flex-col items-start p-6 rounded-3xl border border-slate-100 hover:border-indigo-100 bg-slate-50/50 hover:bg-indigo-50/20 transition-all text-left shadow-sm hover:shadow-md cursor-pointer relative overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 rounded-bl-full pointer-events-none group-hover:scale-105 transition-transform"></div>
                        <div className={`w-12 h-12 bg-gradient-to-r ${cat.gradient} text-white rounded-2xl flex items-center justify-center mb-4 shadow-lg`}>
                          <Icon size={22} />
                        </div>
                        <h4 className="font-black text-slate-800 text-sm flex items-center gap-1">
                          {cat.name}
                          <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 translate-x-[-4px] group-hover:translate-x-0 transition-all" />
                        </h4>
                        <p className="text-xs text-slate-500 mt-1.5">{cat.desc}</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Billers */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h3 className="text-lg font-black text-slate-800 tracking-tight">{selectedCategory} Providers</h3>
                <div className="relative w-full max-w-sm">
                  <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search providers..."
                    value={searchBillerQuery}
                    onChange={(e) => setSearchBillerQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-2xl border border-slate-200 outline-none text-xs font-semibold text-slate-700 focus:bg-white focus:border-indigo-500 transition-all shadow-inner"
                  />
                </div>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="w-10 h-10 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin"></div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Fetching providers...</p>
                </div>
              ) : filteredBillers.length === 0 ? (
                <div className="text-center py-16 text-slate-400 space-y-2">
                  <Info size={32} className="mx-auto text-slate-300" />
                  <p className="text-xs font-black text-slate-600">No Providers Found</p>
                  <p className="text-[11px]">Could not find providers matching your search.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredBillers.map((biller, idx) => (
                    <button
                      key={idx}
                      onClick={() => selectBiller(biller)}
                      className="p-5 rounded-2xl border border-slate-100 hover:border-slate-300 hover:bg-slate-50 text-left transition-all flex items-center justify-between group cursor-pointer shadow-sm"
                    >
                      <div className="space-y-0.5 max-w-[85%]">
                        <p className="text-xs font-black text-slate-800 line-clamp-1 group-hover:text-indigo-600 transition-colors">{biller.billerName}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{biller.billerId}</p>
                      </div>
                      <ChevronRight size={16} className="text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Form inputs & validation */}
          {step === 3 && selectedBiller && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: Form Inputs */}
              <div className="lg:col-span-7 space-y-6">
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4">
                  <div className="w-10 h-10 bg-indigo-500/10 text-indigo-600 rounded-xl flex items-center justify-center font-bold">
                    BA
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-800 leading-none">{selectedBiller.billerName}</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">{selectedCategory}</p>
                  </div>
                </div>

                <form onSubmit={handleFetchBill} className="space-y-4">
                  {inputParams.map((param, idx) => (
                    <div key={idx} className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                        {param.paramName}
                        {!param.optional && <span className="text-rose-500">*</span>}
                      </label>
                      <input
                        type="text"
                        required={!param.optional}
                        value={formInputs[param.paramName] || ''}
                        onChange={(e) => setFormInputs({ ...formInputs, [param.paramName]: e.target.value })}
                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 outline-none text-xs font-semibold text-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all bg-white"
                        placeholder={`Enter ${param.paramName.toLowerCase()}`}
                      />
                    </div>
                  ))}

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Customer Mobile Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={customerMobile}
                      onChange={(e) => setCustomerMobile(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 outline-none text-xs font-semibold text-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all bg-white"
                      placeholder="Enter 10-digit mobile number"
                    />
                  </div>

                  {selectedCategory !== 'Mobile Prepaid' && (
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {loading ? 'Fetching details...' : 'Fetch Bill Details'}
                    </button>
                  )}
                </form>

                {/* Prepaid Plan List for mobile recharge */}
                {selectedCategory === 'Mobile Prepaid' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Select Recharge Plan</h4>
                      {planLoading && <span className="text-[10px] text-indigo-600 animate-pulse font-bold">Loading plans...</span>}
                    </div>

                    <div className="max-h-[300px] overflow-y-auto space-y-3 pr-2 no-scrollbar border border-slate-100 rounded-2xl p-3 bg-slate-50/50">
                      {plans.length === 0 && !planLoading ? (
                        <div className="text-center py-10 text-slate-400 text-xs">
                          No plans retrieved. You can enter transaction amount manually.
                        </div>
                      ) : (
                        plans.map((p, idx) => (
                          <div
                            key={idx}
                            onClick={() => {
                              setSelectedPlan(p);
                              setManualAmount(p.amount);
                            }}
                            className={`p-4 rounded-xl border transition-all cursor-pointer flex justify-between items-center ${
                              selectedPlan === p ? 'bg-indigo-50/50 border-indigo-500 shadow-sm' : 'bg-white border-slate-200/60 hover:bg-slate-50'
                            }`}
                          >
                            <div className="space-y-1 pr-4">
                              <p className="text-xs font-black text-slate-800">
                                ₹{p.amount} <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded font-bold">{p.validity}</span>
                              </p>
                              <p className="text-[11px] text-slate-500 leading-normal">{p.description}</p>
                            </div>
                            <ChevronRight size={16} className={selectedPlan === p ? 'text-indigo-600' : 'text-slate-400'} />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Bill Details and Payment summary */}
              <div className="lg:col-span-5 border-t lg:border-t-0 lg:border-l border-slate-100 lg:pl-8 pt-8 lg:pt-0">
                <div className="space-y-6">
                  <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider">Bill Summary</h3>

                  {loading && !billDetails && (
                    <div className="flex items-center justify-center py-12">
                      <div className="w-8 h-8 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin"></div>
                    </div>
                  )}

                  {!loading && !billDetails && selectedCategory !== 'Mobile Prepaid' && (
                    <div className="p-8 border border-dashed border-slate-200 rounded-3xl text-center text-slate-400 space-y-2">
                      <HelpCircle size={24} className="mx-auto text-slate-300" />
                      <p className="text-xs font-black text-slate-600">No Details Fetched</p>
                      <p className="text-[10px]">Enter account parameters and click Fetch Bill Details.</p>
                    </div>
                  )}

                  {(billDetails || selectedCategory === 'Mobile Prepaid') && (
                    <div className="bg-slate-50 border border-slate-200 rounded-[24px] p-6 space-y-6">
                      <div className="border-b border-slate-200 pb-4 flex justify-between items-start">
                        <div>
                          <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded font-black uppercase tracking-wider">Verified Info</span>
                          <h4 className="text-sm font-black text-slate-800 mt-2">{billDetails ? billDetails.customerName : 'Prepaid Recharge'}</h4>
                        </div>
                        {billDetails && (
                          <button
                            onClick={() => {
                              setBillDetails(null);
                              setManualAmount('');
                            }}
                            className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-all"
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>

                      {(!billDetails || billDetails.fetchSupported) ? (
                        <div className="space-y-4">
                          {billDetails && (
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-400 font-bold uppercase tracking-wider">Due Amount</span>
                              <span className="text-xl font-black text-slate-800">₹{billDetails.billAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                          )}

                          <div className="space-y-2 border-t border-slate-100 pt-3 mt-3">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Payment Amount (₹)</label>
                            <input
                              type="number"
                              required
                              value={manualAmount}
                              onChange={(e) => setManualAmount(e.target.value)}
                              placeholder="Enter exact amount to pay"
                              disabled={selectedPlan !== null}
                              className="w-full bg-white border border-slate-200 focus:border-indigo-500 outline-none rounded-xl px-4 py-3 text-sm font-bold text-slate-800 transition-colors"
                            />
                          </div>

                          {manualAmount && !isNaN(Number(manualAmount)) && Number(manualAmount) > 0 && (
                            <div className="bg-indigo-50/50 border border-indigo-100/50 rounded-2xl p-4 space-y-2">
                              <div className="flex justify-between items-center text-xs text-slate-500 font-medium">
                                <span>Bill Base Amount</span>
                                <span className="font-bold text-slate-700">₹{Number(manualAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                              </div>
                              <div className="flex justify-between items-center text-xs text-slate-500 font-medium">
                                <span>Transaction Charges</span>
                                <span className="font-bold text-indigo-600">+ ₹{calculateServiceCharge(Number(manualAmount)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                              </div>
                              {ccf1Fee > 0 && (
                                <div className="flex justify-between items-center text-xs text-slate-500 font-medium">
                                  <span>Convenience Fee (CCF1 + GST)</span>
                                  <span className="font-bold text-indigo-600">+ ₹{ccf1Fee.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                </div>
                              )}
                              <div className="border-t border-indigo-100/60 pt-2 flex justify-between items-center text-sm font-black text-slate-800">
                                <span>Total Debited</span>
                                <span className="text-base text-emerald-600">₹{(Number(manualAmount) + calculateServiceCharge(Number(manualAmount)) + ccf1Fee).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                              </div>
                            </div>
                          )}

                          {billDetails?.dueDate && (
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-400 font-bold uppercase tracking-wider">Due Date</span>
                              <span className="font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded">{billDetails.dueDate}</span>
                            </div>
                          )}
                          {billDetails?.billNumber && billDetails.billNumber !== "NA" && (
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-400 font-bold uppercase tracking-wider">Bill Number</span>
                              <span className="font-bold text-slate-600">{billDetails.billNumber}</span>
                            </div>
                          )}
                          {billDetails?.billDate && billDetails.billDate !== "NA" && (
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-400 font-bold uppercase tracking-wider">Bill Date</span>
                              <span className="font-bold text-slate-600">{billDetails.billDate}</span>
                            </div>
                          )}
                          {billDetails?.billPeriod && billDetails.billPeriod !== "NA" && (
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-400 font-bold uppercase tracking-wider">Bill Period</span>
                              <span className="font-bold text-slate-600">{billDetails.billPeriod}</span>
                            </div>
                          )}
                          {billDetails?.additionalInfo && billDetails.additionalInfo
                            .filter((info: any) => info.infoName && info.infoName.toLowerCase() !== "maximum permissible amount")
                            .map((info: any) => (
                              <div key={info.infoName} className="flex justify-between items-center text-xs border-t border-slate-100 pt-3 mt-3">
                                <span className="text-slate-400 font-bold uppercase tracking-wider">{info.infoName}</span>
                                <span className="font-bold text-slate-600">
                                  {info.infoName.toLowerCase().includes("amount") && !isNaN(Number(info.infoValue))
                                    ? `₹${Number(info.infoValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                    : info.infoValue}
                                </span>
                              </div>
                            ))}
                        </div>
                      ) : (
                        // Manual entry (QuickPay)
                        <div className="space-y-4">
                          <div className="bg-amber-50 border border-amber-100 text-amber-700 p-3.5 rounded-xl text-xs flex gap-2">
                            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                            <p className="leading-relaxed font-medium">Direct fetch is unsupported. Enter amount manually to pay via <strong>QuickPay</strong>.</p>
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Payment Amount (₹)</label>
                            <input
                              type="number"
                              required
                              value={manualAmount}
                              onChange={(e) => setManualAmount(e.target.value)}
                              placeholder="Enter exact amount to pay"
                              className="w-full bg-white border border-slate-200 focus:border-indigo-500 outline-none rounded-xl px-4 py-3 text-sm font-bold text-slate-800 transition-colors"
                            />
                          </div>

                          {manualAmount && !isNaN(Number(manualAmount)) && Number(manualAmount) > 0 && (
                            <div className="bg-indigo-50/50 border border-indigo-100/50 rounded-2xl p-4 space-y-2">
                              <div className="flex justify-between items-center text-xs text-slate-500 font-medium">
                                <span>Bill Base Amount</span>
                                <span className="font-bold text-slate-700">₹{Number(manualAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                              </div>
                              <div className="flex justify-between items-center text-xs text-slate-500 font-medium">
                                <span>Transaction Charges</span>
                                <span className="font-bold text-indigo-600">+ ₹{calculateServiceCharge(Number(manualAmount)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                              </div>
                              {ccf1Fee > 0 && (
                                <div className="flex justify-between items-center text-xs text-slate-500 font-medium">
                                  <span>Convenience Fee (CCF1 + GST)</span>
                                  <span className="font-bold text-indigo-600">+ ₹{ccf1Fee.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                </div>
                              )}
                              <div className="border-t border-indigo-100/60 pt-2 flex justify-between items-center text-sm font-black text-slate-800">
                                <span>Total Debited</span>
                                <span className="text-base text-emerald-600">₹{(Number(manualAmount) + calculateServiceCharge(Number(manualAmount)) + ccf1Fee).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={initiatePayment}
                          disabled={loading || (!billDetails?.fetchSupported && !manualAmount)}
                          className="w-full py-4 text-white rounded-2xl font-black text-sm uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] cursor-pointer bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100"
                        >
                          <ShieldCheck size={16} />
                          Pay Securely Now
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Success Receipt */}
          {step === 4 && receipt && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-full max-w-sm bg-white border border-slate-200 rounded-[32px] p-6 shadow-xl space-y-6 relative" id="receipt-print-area">
                <div className="absolute top-4 right-4 z-10">
                  <img src="/assured_logo.png" alt="Be-Assured Logo" className="h-[30px] w-auto object-contain" />
                </div>

                <div className="text-center border-b border-dashed border-slate-100 pb-5">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <CheckCircle2 className="text-emerald-500" size={40} />
                    <span className="text-[10px] bg-slate-900 text-white px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider">BBPS Receipt</span>
                  </div>
                  <div className="text-2xl font-black text-slate-800 mt-4">
                    ₹{(receipt.amount + (receipt.charges || 0) + (receipt.ccf1Fee || 0)).toFixed(2)}
                  </div>
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1">Transaction Success</p>
                </div>

                <div className="space-y-4 text-xs font-semibold text-slate-600">
                  <div className="flex justify-between">
                    <span className="text-slate-400 uppercase tracking-wider text-[9px]">Provider</span>
                    <span className="font-black text-slate-800 text-right">{receipt.billerName}</span>
                  </div>
                  {Object.entries(receipt.consumerDetails).map(([key, val]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-slate-400 uppercase tracking-wider text-[9px]">{key}</span>
                      <span className="font-black text-slate-800 text-right">{String(val)}</span>
                    </div>
                  ))}
                  <div className="border-t border-slate-100 pt-3 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400 uppercase tracking-wider text-[9px]">Base Amount</span>
                      <span className="font-black text-slate-850 text-right">₹{receipt.amount.toFixed(2)}</span>
                    </div>
                    {receipt.charges > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 uppercase tracking-wider text-[9px]">Transaction Charges</span>
                        <span className="font-black text-slate-850 text-right">₹{receipt.charges.toFixed(2)}</span>
                      </div>
                    )}
                    {receipt.ccf1Fee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 uppercase tracking-wider text-[9px]">Convenience Fee</span>
                        <span className="font-black text-slate-850 text-right">₹{receipt.ccf1Fee.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between border-t border-slate-100 pt-3">
                    <span className="text-slate-400 uppercase tracking-wider text-[9px]">Transaction Ref</span>
                    <span className="font-black text-slate-800 font-mono text-[10px] bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                      {receipt.txnid}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 uppercase tracking-wider text-[9px]">Date & Time</span>
                    <span className="font-black text-slate-800 text-right">{receipt.date}</span>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-5 flex items-center justify-between text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none">
                  <div className="flex items-center gap-1">
                    <ShieldCheck size={11} className="text-emerald-500" />
                    BillAvenue Secured
                  </div>
                  <span>UAT STAGING</span>
                </div>
              </div>

              <div className="mt-8 flex gap-4 w-full max-w-sm">
                <button
                  onClick={() => window.print()}
                  className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer border border-slate-200/50"
                >
                  <Printer size={14} />
                  Print
                </button>
                <button
                  onClick={() => {
                    setStep(1);
                    setReceipt(null);
                    setBillDetails(null);
                    setFormInputs({});
                    setSelectedBiller(null);
                  }}
                  className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-100"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* TPIN MODAL DIALOG */}
      <AnimatePresence>
        {showTpinModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTpinModal(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative z-10 w-full max-w-sm bg-white rounded-[32px] p-6 shadow-2xl space-y-6 border border-slate-100"
            >
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center mx-auto text-indigo-600 shadow-inner">
                  <Lock size={20} />
                </div>
                <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Security Check</h3>
                <p className="text-slate-400 text-xs">Enter your 4-digit security TPIN to approve this payment request.</p>
              </div>

              <form onSubmit={handleTpinSubmit} className="space-y-4">
                <div className="relative">
                  <input
                    type={showTpinDigits ? 'text' : 'password'}
                    maxLength={4}
                    autoFocus
                    required
                    value={tpinInput}
                    onChange={(e) => setTpinInput(e.target.value.replace(/\D/g, ''))}
                    className="w-full text-center tracking-[1.5em] text-lg font-black py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner text-slate-700"
                    placeholder="••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTpinDigits(!showTpinDigits)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showTpinDigits ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {tpinError && (
                  <div className="p-3 bg-rose-50 rounded-xl border border-rose-100 flex items-center gap-2 text-[10px] text-rose-500 font-bold uppercase">
                    <AlertTriangle size={14} className="shrink-0" />
                    {tpinError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={tpinLoading}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-indigo-100"
                >
                  {tpinLoading ? 'Verifying...' : 'Authorize Transaction'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
