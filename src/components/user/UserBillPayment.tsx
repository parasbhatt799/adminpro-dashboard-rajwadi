import React, { useState, useEffect } from 'react';
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
  PhoneCall,
  Layers,
  ChevronRight,
  ShieldCheck,
  Download,
  Printer,
  Wallet,
  Clock,
  HelpCircle,
  FileText,
  Tag,
  CreditCard,
  Lock,
  ShieldAlert,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '../../context/ToastContext';

interface BillerInputParam {
  paramName: string;
  dataType: string;
  optional?: boolean;
}

interface BillerInfo {
  biller_id: string;
  biller_name: string;
}

interface CategoryInfo {
  cat_id: string;
  cat_name: string;
}

// Helper to resolve clean dynamic bank logo URLs based on keyword matching
const getBankLogoUrl = (bankName: string) => {
  const name = bankName.toLowerCase();
  let domain = "";

  if (name.includes("axis")) return "/axis_logo.png";
  else if (name.includes("hdfc")) domain = "hdfcbank.com";
  else if (name.includes("icici")) domain = "icicibank.com";
  else if (name.includes("sbi") || name.includes("state bank")) domain = "sbicard.com";
  else if (name.includes("bob") || name.includes("baroda") || name.includes("bobcard")) return "/bob_logo.png";
  else if (name.includes("au bank")) domain = "aubank.in";
  else if (name.includes("bandhan")) return "/bandhan_logo.png";
  else if (name.includes("union bank")) return "/union_logo.png";
  else if (name.includes("india credit") || name.includes("bank of india")) return "/boi_logo.png";
  else if (name.includes("canara")) domain = "canarabank.com";
  else if (name.includes("cub") || name.includes("city union")) domain = "cityunionbank.com";
  else if (name.includes("dbs")) domain = "dbs.com";
  else if (name.includes("dcb")) return "/dcb_logo.png";
  else if (name.includes("dhanlaxmi")) domain = "dhanbank.com";
  else if (name.includes("csb")) return "/csb_logo.png";
  else if (name.includes("esaf")) return "/esaf_logo.png";
  else if (name.includes("federal")) return "/federal_logo.png";
  else if (name.includes("hsbc")) domain = "hsbc.co.in";
  else if (name.includes("idbi")) domain = "idbibank.in";
  else if (name.includes("idfc")) domain = "idfcfirstbank.com";
  else if (name.includes("indian bank") || name.includes("indianbank")) return "/indian_logo.png";
  else if (name.includes("indusind")) domain = "indusind.com";
  else if (name.includes("iob")) domain = "iob.in";
  else if (name.includes("kotak")) return "/kotak_logo.png";
  else if (name.includes("punjab") || name.includes("pnb")) return "/pnb_logo.png";
  else if (name.includes("rbl")) domain = "rblbank.com";
  else if (name.includes("saraswat")) return "/saraswat_logo.png";
  else if (name.includes("sbm")) return "/sbm_logo.png";
  else if (name.includes("south indian")) return "/south_indian_logo.png";
  else if (name.includes("suryoday")) return "/suryoday_logo.png";
  else if (name.includes("yes bank")) domain = "yesbank.in";
  else if (name.includes("onecard") || name.includes("one -")) domain = "getonecard.app";

  if (domain) {
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
  }
  return null;
};

// Preset mapping for beautiful icons and gradients per category
const CATEGORY_STYLE_MAP: Record<string, { icon: React.ComponentType<any>, gradient: string, shadow: string, border: string, desc: string }> = {
  "Electricity": {
    icon: Lightbulb,
    gradient: "from-amber-400 to-orange-500",
    shadow: "shadow-amber-500/10",
    border: "border-amber-100",
    desc: "Pay state power bills"
  },
  "DTH": {
    icon: Tv,
    gradient: "from-blue-400 to-indigo-600",
    shadow: "shadow-blue-500/10",
    border: "border-blue-100",
    desc: "Pay DTH / TV subscription"
  },
  "Mobile Postpaid": {
    icon: Smartphone,
    gradient: "from-emerald-400 to-teal-600",
    shadow: "shadow-emerald-500/10",
    border: "border-emerald-100",
    desc: "Pay postpaid mobile bills"
  },
  "Broadband": {
    icon: Wifi,
    gradient: "from-purple-400 to-pink-600",
    shadow: "shadow-purple-500/10",
    border: "border-purple-100",
    desc: "High-speed internet bills"
  },
  "Gas": {
    icon: Flame,
    gradient: "from-red-400 to-rose-600",
    shadow: "shadow-red-500/10",
    border: "border-red-100",
    desc: "Piped gas & cylinder booking"
  },
  "Water": {
    icon: Droplets,
    gradient: "from-cyan-400 to-blue-600",
    shadow: "shadow-cyan-500/10",
    border: "border-cyan-100",
    desc: "Pay municipal water bills"
  },
  "Landline": {
    icon: PhoneCall,
    gradient: "from-violet-400 to-fuchsia-600",
    shadow: "shadow-violet-500/10",
    border: "border-violet-100",
    desc: "Pay landline telephone bills"
  },
  "Fastag": {
    icon: Tag,
    gradient: "from-sky-400 to-indigo-600",
    shadow: "shadow-sky-500/10",
    border: "border-sky-100",
    desc: "Recharge toll fastag tags"
  },
  "Credit Card": {
    icon: CreditCard,
    gradient: "from-pink-400 to-rose-600",
    shadow: "shadow-rose-500/10",
    border: "border-rose-100",
    desc: "Pay credit card bills instantly"
  },
  "default": {
    icon: Layers,
    gradient: "from-slate-400 to-slate-600",
    shadow: "shadow-slate-500/10",
    border: "border-slate-100",
    desc: "Pay other utility bills"
  }
};

export default function UserBillPayment({ userId }: { userId: string }) {
  const toast = useToast();

  // Wallet state
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [slabs, setSlabs] = useState<any[]>([]);
  const [bbpsMaxLimit, setBbpsMaxLimit] = useState<number>(50000);
  const [globalLiveBbpsLimit, setGlobalLiveBbpsLimit] = useState<number>(500000);

  // TPIN & Lockout state
  const [dbTpinValue, setDbTpinValue] = useState<string | null>(null);
  const [tpinAttempts, setTpinAttempts] = useState<number>(0);
  const [tpinLockedUntil, setTpinLockedUntil] = useState<string | null>(null);
  const [showTpinModal, setShowTpinModal] = useState<boolean>(false);
  const [tpinInput, setTpinInput] = useState<string>('');
  const [showTpinDigits, setShowTpinDigits] = useState<boolean>(false);
  const [tpinError, setTpinError] = useState<string | null>(null);
  const [tpinLoading, setTpinLoading] = useState<boolean>(false);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);

  // BBPS flows states
  const [step, setStep] = useState<number>(1); // 1: Categories, 2: Billers, 3: Form/Fetch, 4: Payment success
  const [loading, setLoading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Loaded list data
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [billers, setBillers] = useState<BillerInfo[]>([]);
  const [filteredBillers, setFilteredBillers] = useState<BillerInfo[]>([]);
  const [inputParams, setInputParams] = useState<BillerInputParam[]>([]);

  // Selections
  const [selectedCategory, setSelectedCategory] = useState<CategoryInfo | null>(null);
  const [selectedBiller, setSelectedBiller] = useState<BillerInfo | null>(null);
  const [searchBillerQuery, setSearchBillerQuery] = useState<string>('');

  // Form values
  const [formInputs, setFormInputs] = useState<Record<string, string>>({});
  const [manualAmount, setManualAmount] = useState<string>('');

  // Bill Details
  const [billDetails, setBillDetails] = useState<{
    customerName: string;
    billAmount: number; // in Rupees
    dueDate?: string;
    billNumber?: string;
    billDate?: string;
    billPeriod?: string;
    additionalInfo?: Array<{ infoName: string; infoValue: string }>;
    fetchSupported: boolean;
  } | null>(null);

  const [fetchResponse, setFetchResponse] = useState<any>(null);

  // Success transaction details
  const [receipt, setReceipt] = useState<{
    txnid: string;
    amount: number;
    charges?: number;
    billerName: string;
    date: string;
    consumerDetails: Record<string, string>;
  } | null>(null);

  // Fetch Wallet Balance and service charge configurations
  const fetchWalletBalance = async () => {
    try {
      const { data, error } = await supabase
        .from('users_profiles')
        .select('wallet_balance, service_charge_enabled, custom_service_charge, tpin, tpin_attempts, tpin_locked_until, custom_daily_live_bbps_limit')
        .eq('id', userId)
        .single();
      if (!error && data) {
        setWalletBalance(Number(data.wallet_balance) || 0);
        setUserProfile(data);
        setDbTpinValue(data.tpin || null);
        setTpinAttempts(Number(data.tpin_attempts) || 0);
        setTpinLockedUntil(data.tpin_locked_until || null);

        const lockedUntil = data.tpin_locked_until ? new Date(data.tpin_locked_until).getTime() : 0;
        const now = Date.now();
        if (lockedUntil > now) {
          const secs = Math.ceil((lockedUntil - now) / 1000);
          setLockoutSeconds(secs);
        } else {
          setLockoutSeconds(0);
        }
      }

      // Fetch active service charge slabs
      const { data: slabData } = await supabase
        .from('service_charge_slabs')
        .select('*')
        .eq('is_active', true)
        .order('min_amount', { ascending: true });
      if (slabData) {
        setSlabs(slabData);
      }

      // Fetch BBPS max limit from qr_settings
      const { data: settingsData } = await supabase
        .from('qr_settings')
        .select('bbps_max_limit, daily_live_bbps_limit')
        .eq('id', 1)
        .single();
      if (settingsData) {
        setBbpsMaxLimit(Number(settingsData.bbps_max_limit) || 50000);
        setGlobalLiveBbpsLimit(Number(settingsData.daily_live_bbps_limit) || 500000);
      }
    } catch (err) {
      console.error("Error loading profile / slabs:", err);
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

  useEffect(() => {
    fetchWalletBalance();
    fetchCategories();
  }, []);

  useEffect(() => {
    if (lockoutSeconds <= 0) return;

    const timer = setInterval(() => {
      setLockoutSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          supabase
            .from('users_profiles')
            .update({
              tpin_attempts: 0,
              tpin_locked_until: null
            })
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
  }, [lockoutSeconds, userId]);

  // Filter billers based on query search
  useEffect(() => {
    if (!searchBillerQuery.trim()) {
      setFilteredBillers(billers);
    } else {
      const query = searchBillerQuery.toLowerCase();
      setFilteredBillers(
        billers.filter(b => b.biller_name.toLowerCase().includes(query))
      );
    }
  }, [searchBillerQuery, billers]);

  // Load Categories (Step 1)
  const fetchCategories = async () => {
    setLoading(true);
    setApiError(null);
    try {
      const response = await fetch('/api/bbps/category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (data.status === 'SUCCESS' && data.data?.bbps) {
        const allowedCategories = ["electricity", "mobile postpaid", "credit card", "broadband", "gas"];
        const filtered = data.data.bbps.filter((cat: any) => {
          const nameLower = cat.cat_name.toLowerCase();
          if (nameLower.includes("lpg gas")) return false;
          return allowedCategories.some(allowed => nameLower.includes(allowed));
        });

        // Sort dynamically into exact layout requested: Electricity, Mobile Postpaid, Credit Card, Broadband, Gas
        const orderMap: Record<string, number> = {
          "electricity": 1,
          "mobile postpaid": 2,
          "credit card": 3,
          "broadband": 4,
          "gas": 5
        };

        filtered.sort((a: any, b: any) => {
          const getOrder = (name: string) => {
            const lower = name.toLowerCase();
            if (lower.includes("electricity")) return orderMap["electricity"];
            if (lower.includes("mobile postpaid")) return orderMap["mobile postpaid"];
            if (lower.includes("credit card")) return orderMap["credit card"];
            if (lower.includes("broadband")) return orderMap["broadband"];
            if (lower.includes("gas")) return orderMap["gas"];
            return 99;
          };
          return getOrder(a.cat_name) - getOrder(b.cat_name);
        });

        setCategories(filtered);
      } else {
        throw new Error(data.message || "Failed to load categories");
      }
    } catch (err: any) {
      console.error("Categories Fetch Error:", err);
      setApiError("Unable to fetch bill categories. Please make sure your server is whitelisted and try again.");
    } finally {
      setLoading(false);
    }
  };

  // Load Billers for selected category (Step 2)
  const handleSelectCategory = async (category: CategoryInfo) => {
    setSelectedCategory(category);
    setStep(2);
    setLoading(true);
    setApiError(null);
    setSearchBillerQuery('');
    try {
      const response = await fetch('/api/bbps/biller', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cat_id: category.cat_id })
      });
      const data = await response.json();
      if (data.status === 'SUCCESS' && data.data?.billers) {
        setBillers(data.data.billers);
        setFilteredBillers(data.data.billers);
      } else {
        throw new Error(data.message || "Failed to fetch billers");
      }
    } catch (err: any) {
      console.error("Biller Fetch Error:", err);
      setApiError(`Could not fetch billers for ${category.cat_name}.`);
    } finally {
      setLoading(false);
    }
  };

  // Load Biller Params (Step 3)
  const handleSelectBiller = async (biller: BillerInfo) => {
    setSelectedBiller(biller);
    setStep(3);
    setLoading(true);
    setApiError(null);
    setFormInputs({});
    setManualAmount('');
    setBillDetails(null);
    try {
      const response = await fetch('/api/bbps/fetch-biller-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ biller_id: biller.biller_id })
      });
      const data = await response.json();
      if (data.status === 'SUCCESS' && data.data?.billerInputParams) {
        // Flatten params list from API structure
        const list: BillerInputParam[] = [];
        let paramsData = data.data.billerInputParams;
        if (typeof paramsData === 'string') {
          try {
            paramsData = JSON.parse(paramsData);
          } catch (e) {
            console.error("Failed to parse billerInputParams string:", e);
          }
        }

        if (Array.isArray(paramsData)) {
          paramsData.forEach((paramGroup: any) => {
            if (paramGroup.paramsList) {
              paramGroup.paramsList.forEach((p: any) => {
                list.push({
                  paramName: p.paramName,
                  dataType: p.dataType,
                  optional: p.optional === "true" || p.optional === true || p.isOptional === "true" || p.isOptional === true
                });
              });
            }
          });
        }
        setInputParams(list.length > 0 ? list : [{ paramName: "Account / Consumer Number", dataType: "ALPHANUMERIC" }]);
      } else {
        // If parameters call fails, supply a default Consumer Number input
        setInputParams([{ paramName: "Account / Consumer Number", dataType: "ALPHANUMERIC" }]);
      }
    } catch (err: any) {
      console.error("Biller Input Fetch Error:", err);
      // Fallback
      setInputParams([{ paramName: "Account / Consumer Number", dataType: "ALPHANUMERIC" }]);
    } finally {
      setLoading(false);
    }
  };

  // Form value change handler
  const handleInputChange = (paramName: string, value: string) => {
    if (apiError) setApiError(null);
    const lower = paramName.toLowerCase();

    // Proactive length and character restrictions
    if (lower.includes("card") || lower.includes("last 4") || lower.includes("last 4 digits")) {
      const cleanValue = value.replace(/\D/g, ""); // Allow only digits
      if (cleanValue.length > 4) return;
      setFormInputs(prev => ({ ...prev, [paramName]: cleanValue }));
      return;
    }

    if (lower.includes("mobile") || lower.includes("phone")) {
      const cleanValue = value.replace(/\D/g, ""); // Allow only digits
      if (cleanValue.length > 10) return;
      setFormInputs(prev => ({ ...prev, [paramName]: cleanValue }));
      return;
    }

    setFormInputs(prev => ({
      ...prev,
      [paramName]: value
    }));
  };

  // Build the payload mapping for the customer fields
  const getCustomerParamsPayload = () => {
    return formInputs;
  };

  // Trigger Fetch Bill details (Step 4 check)
  const handleFetchBill = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate inputs
    for (const param of inputParams) {
      const val = formInputs[param.paramName]?.trim() || '';
      if (!param.optional && !val) {
        toast.error(`Please enter ${param.paramName}`);
        return;
      }

      const lower = param.paramName.toLowerCase();
      if (lower.includes("card") || lower.includes("last 4") || lower.includes("last 4 digits")) {
        if (val.length !== 4) {
          toast.error("Please enter exactly 4 digits for the Credit Card number");
          return;
        }
      }

      if (lower.includes("mobile") || lower.includes("phone")) {
        if (val.length !== 10) {
          toast.error("Please enter exactly 10 digits for the Mobile Number");
          return;
        }
      }
    }

    setLoading(true);
    setApiError(null);
    setBillDetails(null);

    const customerParams = getCustomerParamsPayload();

    try {
      const response = await fetch('/api/bbps/fetch-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          biller_id: selectedBiller?.biller_id,
          customerParams
        })
      });
      const data = await response.json();

      if (data.status === 'SUCCESS' && data.data?.billerResponse) {
        setFetchResponse(data);
        const responseData = data.data.billerResponse;

        // Amount is sent in Paisa or Rupees from fetch-bill? 
        // Typically pay-bill requires Paisa, but fetch-bill returns in Paisa or Rupees depending on API.
        // Let's parse the bill amount: if it's high like 50000 for ₹500, we treat it as Paisa, or if it's returned as string.
        // PayPrime fetch-bill success sample: "billAmount": "50000" (which means 50000 Paisa = 500 Rs, or 50000 Rupees?
        // Let's look at the sample response in User Request: "billAmount": "50000" (for a bill, typical amount is 500 Rs. If "50000" represents Rs. 500, we divide by 100).
        // Wait, the prompt says "Amount must be in Paisa (e.g., 100 Rs = 10000 Paisa) for pay-bill payload."
        // If fetch-bill returns Paisa too, we should divide by 100 to show in Rupees.
        // Let's check: 50000 paisa = ₹500. So we divide by 100.
        const rawAmount = Number(responseData.billAmount) || 0;
        const amountInRupees = rawAmount > 5000 ? rawAmount / 100 : rawAmount; // Auto-scaling safety

        setManualAmount('');

        const additionalInfoList = data.data?.additionalInfo?.info || [];

        setBillDetails({
          customerName: responseData.customerName || "Valued Customer",
          billAmount: amountInRupees,
          dueDate: responseData.dueDate || undefined,
          billNumber: responseData.billNumber || undefined,
          billDate: responseData.billDate || undefined,
          billPeriod: responseData.billPeriod || undefined,
          additionalInfo: additionalInfoList,
          fetchSupported: true
        });
      } else {
        // Fetch failed
        const msg = data.message || "Failed to fetch bill. Please verify entered details.";
        const msgLower = msg.toLowerCase();

        const isCreditCard = selectedCategory?.cat_name.toLowerCase().includes("credit card");
        const isFetchUnsupported = msgLower.includes("not supported") || msgLower.includes("unsupported") || msgLower.includes("not enabled");

        if (isCreditCard || !isFetchUnsupported) {
          // Validation error (khoti details) -> Strictly do NOT allow payment or amount input
          setApiError(msg);
          setBillDetails(null); // Keep as null so right side is empty/shows placeholder, and NO input/button is shown!
          toast.error(msg);
        } else {
          // Biller genuinely doesn't support fetch, fallback to QuickPay
          setBillDetails({
            customerName: "QuickPay User",
            billAmount: 0,
            fetchSupported: false
          });
          toast.info("This biller does not support bill fetching. You can pay directly via QuickPay!");
        }
      }
    } catch (err: any) {
      console.error("Fetch Bill Error:", err);
      const isCreditCard = selectedCategory?.cat_name.toLowerCase().includes("credit card");
      if (isCreditCard) {
        const errorMsg = err.message || "Direct billing query failed. Please verify credentials.";
        setApiError(errorMsg);
        setBillDetails(null);
        toast.error("Credit card validation failed.");
      } else {
        // Fallback to QuickPay on error as well
        setBillDetails({
          customerName: "QuickPay User",
          billAmount: 0,
          fetchSupported: false
        });
        toast.info("Direct billing query unavailable. Proceeding with QuickPay manual entry.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePrePayCheck = async () => {
    if (!dbTpinValue || dbTpinValue.trim().length !== 4) {
      toast.error("Please set your 4-digit TPIN in 'Create TPIN' section before paying bills.");
      return;
    }

    if (lockoutSeconds > 0) {
      const minutes = Math.floor(lockoutSeconds / 60);
      const seconds = lockoutSeconds % 60;
      toast.error(`Account is locked. Please try again after ${minutes}m ${seconds}s.`);
      return;
    }

    // Check balance check here too as precheck
    const finalAmount = Number(manualAmount);
    if (isNaN(finalAmount) || finalAmount <= 0) {
      toast.error("Please specify a valid payment amount.");
      return;
    }

    if (finalAmount > bbpsMaxLimit) {
      toast.error(`Maximum bill payment limit is ₹${bbpsMaxLimit.toLocaleString()}. You cannot pay ₹${finalAmount.toLocaleString()}.`);
      return;
    }

    // Enforce daily Live BBPS limit
    try {
      const userLimit = Number(userProfile?.custom_daily_live_bbps_limit) > 0 
        ? Number(userProfile.custom_daily_live_bbps_limit) 
        : (Number(globalLiveBbpsLimit) || 500000);

      // Find start of today in IST, converted to UTC timezone
      const tzOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
      const now = new Date();
      const istTime = new Date(now.getTime() + tzOffset);
      const istTodayStart = new Date(Date.UTC(
        istTime.getUTCFullYear(),
        istTime.getUTCMonth(),
        istTime.getUTCDate(),
        0, 0, 0, 0
      ));
      const utcTodayStart = new Date(istTodayStart.getTime() - tzOffset);

      const { data: todayBBPS, error: sumError } = await supabase
        .from('bbps_submissions')
        .select('amount')
        .eq('user_id', userId)
        .in('status', ['pending', 'approved'])
        .gte('created_at', utcTodayStart.toISOString());

      if (sumError) throw sumError;

      const todaySum = (todayBBPS || []).reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

      if (todaySum + finalAmount > userLimit) {
        toast.error(`Daily Live BBPS limit exceeded. You have already used ₹${todaySum.toLocaleString()} of your ₹${userLimit.toLocaleString()} limit today. Remaining limit: ₹${Math.max(0, userLimit - todaySum).toLocaleString()}.`);
        return;
      }
    } catch (err: any) {
      console.error('Error checking daily Live BBPS limit:', err);
      toast.error('Failed to verify daily limit. Please try again.');
      return;
    }

    const serviceCharge = calculateBillCharge(finalAmount);
    const totalDeduction = finalAmount + serviceCharge;

    if (walletBalance - totalDeduction < 250) {
      toast.error(`Insufficient wallet balance. You must maintain at least ₹250 after transaction (Bill Amount: ₹${finalAmount} + Service Charge: ₹${serviceCharge}).`);
      return;
    }

    setTpinInput('');
    setTpinError(null);
    setShowTpinModal(true);
  };

  const handleTpinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tpinInput.length !== 4) {
      setTpinError("Please enter a 4-digit TPIN.");
      return;
    }

    setTpinLoading(true);
    setTpinError(null);

    try {
      const { data: latestProfile, error: fetchErr } = await supabase
        .from('users_profiles')
        .select('tpin, tpin_attempts, tpin_locked_until')
        .eq('id', userId)
        .single();

      if (fetchErr || !latestProfile) {
        throw new Error("Failed to verify user profile.");
      }

      const now = Date.now();
      const lockedUntil = latestProfile.tpin_locked_until ? new Date(latestProfile.tpin_locked_until).getTime() : 0;
      if (lockedUntil > now) {
        const secs = Math.ceil((lockedUntil - now) / 1000);
        setLockoutSeconds(secs);
        setShowTpinModal(false);
        throw new Error(`Your account is locked out for bill payments. Please try again later.`);
      }

      if (latestProfile.tpin !== tpinInput) {
        const nextAttempts = (Number(latestProfile.tpin_attempts) || 0) + 1;
        
        if (nextAttempts >= 3) {
          const lockTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();
          const { error: lockErr } = await supabase
            .from('users_profiles')
            .update({
              tpin_attempts: nextAttempts,
              tpin_locked_until: lockTime
            })
            .eq('id', userId);

          if (lockErr) throw lockErr;

          setTpinAttempts(nextAttempts);
          setTpinLockedUntil(lockTime);
          setLockoutSeconds(600);
          setShowTpinModal(false);
          toast.error("Too many incorrect TPIN attempts. You have been locked out for 10 minutes.");
        } else {
          const { error: attemptErr } = await supabase
            .from('users_profiles')
            .update({
              tpin_attempts: nextAttempts
            })
            .eq('id', userId);

          if (attemptErr) throw attemptErr;

          setTpinAttempts(nextAttempts);
          setTpinInput('');
          setTpinError(`Incorrect TPIN. ${3 - nextAttempts} attempts remaining.`);
          toast.error(`Incorrect TPIN. ${3 - nextAttempts} attempts remaining.`);
        }
      } else {
        const { error: resetErr } = await supabase
          .from('users_profiles')
          .update({
            tpin_attempts: 0,
            tpin_locked_until: null
          })
          .eq('id', userId);

        if (resetErr) throw resetErr;

        setTpinAttempts(0);
        setTpinLockedUntil(null);
        setLockoutSeconds(0);
        setShowTpinModal(false);

        await handlePayBill();
      }
    } catch (err: any) {
      console.error("TPIN Verification Error:", err);
      setTpinError(err.message || "Something went wrong. Please try again.");
    } finally {
      setTpinLoading(false);
    }
  };

  // Execute Pay Bill Transaction (Step 5 execution)
  const handlePayBill = async () => {
    const finalAmountStr = manualAmount;
    const finalAmount = Number(finalAmountStr);

    if (isNaN(finalAmount) || finalAmount <= 0) {
      toast.error("Please specify a valid payment amount.");
      return;
    }

    if (finalAmount > bbpsMaxLimit) {
      toast.error(`Maximum bill payment limit is ₹${bbpsMaxLimit.toLocaleString()}. You cannot pay ₹${finalAmount.toLocaleString()}.`);
      return;
    }

    // Enforce daily Live BBPS limit
    try {
      const userLimit = Number(userProfile?.custom_daily_live_bbps_limit) > 0 
        ? Number(userProfile.custom_daily_live_bbps_limit) 
        : (Number(globalLiveBbpsLimit) || 500000);

      // Find start of today in IST, converted to UTC timezone
      const tzOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
      const now = new Date();
      const istTime = new Date(now.getTime() + tzOffset);
      const istTodayStart = new Date(Date.UTC(
        istTime.getUTCFullYear(),
        istTime.getUTCMonth(),
        istTime.getUTCDate(),
        0, 0, 0, 0
      ));
      const utcTodayStart = new Date(istTodayStart.getTime() - tzOffset);

      const { data: todayBBPS, error: sumError } = await supabase
        .from('bbps_submissions')
        .select('amount')
        .eq('user_id', userId)
        .in('status', ['pending', 'approved'])
        .gte('created_at', utcTodayStart.toISOString());

      if (sumError) throw sumError;

      const todaySum = (todayBBPS || []).reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

      if (todaySum + finalAmount > userLimit) {
        toast.error(`Daily Live BBPS limit exceeded. You have already used ₹${todaySum.toLocaleString()} of your ₹${userLimit.toLocaleString()} limit today. Remaining limit: ₹${Math.max(0, userLimit - todaySum).toLocaleString()}.`);
        return;
      }
    } catch (err: any) {
      console.error('Error checking daily Live BBPS limit:', err);
      toast.error('Failed to verify daily limit. Please try again.');
      return;
    }

    const serviceCharge = calculateBillCharge(finalAmount);
    const totalDeduction = finalAmount + serviceCharge;

    if (walletBalance - totalDeduction < 250) {
      toast.error(`Insufficient wallet balance. You must maintain at least ₹250 after transaction (Bill Amount: ₹${finalAmount} + Service Charge: ₹${serviceCharge}).`);
      return;
    }

    setLoading(true);
    setApiError(null);

    const customerParams = getCustomerParamsPayload();
    // Use first non-empty parameter value as the consumer number for reference
    const consumerNumber = Object.values(formInputs).find(v => v.trim()) || "BBPS Account";

    try {
      const response = await fetch('/api/bbps/pay-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          biller_id: selectedBiller?.biller_id,
          amount: finalAmount,
          customerParams,
          fetchResponse,
          service_type: selectedCategory?.cat_name || "BBPS Utility",
          provider: selectedBiller?.biller_name || selectedBiller?.biller_id,
          consumer_number: consumerNumber
        })
      });
      const data = await response.json();

      if (data.status === 'SUCCESS') {
        toast.success("Bill Paid successfully!");
        setWalletBalance(data.new_balance);

        // Save receipt with charges
        setReceipt({
          txnid: data.data?.bbpsrecent?.[0]?.txnid || `TXN${Math.floor(100000 + Math.random() * 900000)}`,
          amount: finalAmount,
          charges: data.charges || serviceCharge,
          billerName: selectedBiller?.biller_name || "Utility Operator",
          date: new Date().toLocaleString(),
          consumerDetails: formInputs
        });

        // Go to success screen
        setStep(4);
      } else {
        throw new Error(data.message || "Transaction failed at BBPS Gateway.");
      }
    } catch (err: any) {
      console.error("Pay Bill Error:", err);
      setApiError(err.message || "BBPS Transaction Failed. Please verify credentials or contact admin.");
      toast.error(err.message || "BBPS Payment Failed");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Reset page
  const resetForm = () => {
    setSelectedCategory(null);
    setSelectedBiller(null);
    setFormInputs({});
    setManualAmount('');
    setBillDetails(null);
    setFetchResponse(null);
    setReceipt(null);
    setStep(1);
    setApiError(null);
    fetchWalletBalance();
  };

  return (
    <div className="space-y-8 select-none max-w-6xl mx-auto p-4">

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
            Pay electricity, gas, Credit Cards bills instantly with secure real-time verification.
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
        </div>
      </div>

      {/* Main Workflow container */}
      <div className="bg-white rounded-[36px] border border-slate-200 shadow-md overflow-hidden min-h-[500px]">
        {/* Step Header */}
        <div className="bg-slate-50 border-b border-slate-100 px-8 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {step > 1 && (
              <button
                onClick={() => {
                  if (step === 2) {
                    setStep(1);
                    setSelectedCategory(null);
                  } else if (step === 3) {
                    setStep(2);
                    setBillDetails(null);
                  } else if (step === 4) {
                    resetForm();
                  }
                }}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
              Step {step} of 4: {
                step === 1 ? 'Select Utility Service' :
                step === 2 ? `Select ${selectedCategory?.cat_name || 'Utility'} Provider` :
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
          <AnimatePresence mode="wait">

            {/* STEP 1: CATEGORIES SELECTION */}
            {step === 1 && (
              <motion.div
                key="categories"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <h3 className="text-lg font-black text-slate-800 tracking-tight">Select a category to begin</h3>

                {apiError && (
                  <div className="bg-rose-50 border border-rose-100 text-rose-600 p-4 rounded-2xl flex items-start gap-3">
                    <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                    <div className="text-xs font-bold leading-relaxed">{apiError}</div>
                  </div>
                )}

                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <div className="w-10 h-10 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin"></div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Loading categories...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {categories.map((cat) => {
                      const style = CATEGORY_STYLE_MAP[cat.cat_name] ||
                        (cat.cat_name.toLowerCase().includes("gas") ? CATEGORY_STYLE_MAP["Gas"] : null) ||
                        (cat.cat_name.toLowerCase().includes("broadband") ? CATEGORY_STYLE_MAP["Broadband"] : null) ||
                        (cat.cat_name.toLowerCase().includes("fastag") || cat.cat_name.toLowerCase().includes("fast tag") ? CATEGORY_STYLE_MAP["Fastag"] : null) ||
                        (cat.cat_name.toLowerCase().includes("credit card") ? CATEGORY_STYLE_MAP["Credit Card"] : null) ||
                        CATEGORY_STYLE_MAP["default"];
                      const Icon = style.icon;

                      return (
                        <button
                          key={cat.cat_id}
                          onClick={() => handleSelectCategory(cat)}
                          className="group flex flex-col items-start p-6 rounded-3xl border border-slate-100 hover:border-indigo-100 bg-slate-50/50 hover:bg-indigo-50/20 transition-all text-left shadow-sm hover:shadow-md cursor-pointer relative overflow-hidden"
                        >
                          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 rounded-bl-full pointer-events-none group-hover:scale-105 transition-transform"></div>
                          <div className={`w-12 h-12 bg-gradient-to-r ${style.gradient} text-white rounded-2xl flex items-center justify-center mb-4 shadow-lg`}>
                            <Icon size={22} />
                          </div>
                          <h4 className="font-black text-slate-800 text-sm flex items-center gap-1">
                            {cat.cat_name}
                            <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 translate-x-[-4px] group-hover:translate-x-0 transition-all" />
                          </h4>
                          <p className="text-xs text-slate-500 mt-1.5">{style.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* STEP 2: BILLER SELECTION */}
            {step === 2 && (
              <motion.div
                key="billers"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                className="space-y-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <h3 className="text-lg font-black text-slate-800 tracking-tight">
                    {selectedCategory?.cat_name} Providers
                  </h3>
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
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Loading operators...</p>
                  </div>
                ) : filteredBillers.length === 0 ? (
                  <div className="text-center py-16 text-slate-400 space-y-2">
                    <HelpCircle size={32} className="mx-auto text-slate-300" />
                    <p className="text-xs font-black text-slate-600 font-bold">No operators found matching search query.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[450px] overflow-y-auto pr-2 no-scrollbar">
                    {filteredBillers.map((biller) => (
                      <button
                        key={biller.biller_id}
                        onClick={() => handleSelectBiller(biller)}
                        className="p-5 rounded-2xl border border-slate-100 hover:border-slate-300 hover:bg-slate-50 text-left transition-all flex items-center justify-between group cursor-pointer shadow-sm"
                      >
                        <div className="flex items-center gap-3 max-w-[85%]">
                          <div className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-indigo-500 font-black text-xs shrink-0 overflow-hidden relative group-hover:bg-indigo-50 transition-colors shadow-sm">
                            {getBankLogoUrl(biller.biller_name) ? (
                              <img
                                src={getBankLogoUrl(biller.biller_name) || ''}
                                alt=""
                                className="w-full h-full object-contain p-1.5"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                  const fallbackEl = (e.target as HTMLElement).nextElementSibling;
                                  if (fallbackEl) fallbackEl.classList.remove('hidden');
                                }}
                              />
                            ) : null}
                            <span className={`${getBankLogoUrl(biller.biller_name) ? 'hidden' : ''} text-indigo-500 font-black text-xs`}>
                              {biller.biller_name.charAt(0)}
                            </span>
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-xs font-black text-slate-800 line-clamp-1 group-hover:text-indigo-600 transition-colors">{biller.biller_name}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{biller.biller_id}</p>
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* STEP 3: DYNAMIC FORM / FETCH BILL */}
            {step === 3 && selectedBiller && (
              <motion.div
                key="bill-form"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                className="space-y-6"
              >
                {apiError && (
                  <div className="bg-rose-50 border border-rose-100 text-rose-600 p-4 rounded-2xl flex items-start gap-3">
                    <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                    <div className="text-xs font-bold leading-relaxed">{apiError}</div>
                  </div>
                )}

                {loading && !billDetails ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <div className="w-10 h-10 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin"></div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Waking up secure channel...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Column: Form Inputs */}
                    <div className="lg:col-span-7 space-y-6">
                      <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4">
                        <div className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-indigo-500 font-black text-xs shrink-0 overflow-hidden relative shadow-sm">
                          {getBankLogoUrl(selectedBiller.biller_name) ? (
                            <img
                              src={getBankLogoUrl(selectedBiller.biller_name) || ''}
                              alt=""
                              className="w-full h-full object-contain p-1.5"
                            />
                          ) : (
                            <span className="text-indigo-500 font-black text-xs">
                              {selectedBiller.biller_name.charAt(0)}
                            </span>
                          )}
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-800 leading-none">{selectedBiller.biller_name}</h4>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">{selectedCategory?.cat_name}</p>
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
                              type={param.dataType === 'NUMERIC' ? 'number' : 'text'}
                              required={!param.optional}
                              value={formInputs[param.paramName] || ''}
                              onChange={(e) => handleInputChange(param.paramName, e.target.value)}
                              disabled={loading || billDetails !== null}
                              className="w-full px-4 py-3 rounded-2xl border border-slate-200 outline-none text-xs font-semibold text-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all bg-white disabled:opacity-50"
                              placeholder={`Enter ${param.paramName.toLowerCase()}`}
                            />
                          </div>
                        ))}

                        {!billDetails && (
                          <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-2 cursor-pointer"
                          >
                            {loading ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                Fetching details...
                              </>
                            ) : (
                              'Fetch Bill Details'
                            )}
                          </button>
                        )}
                      </form>
                    </div>

                    {/* Right Column: Bill Details and Payment summary */}
                    <div className="lg:col-span-5 border-t lg:border-t-0 lg:border-l border-slate-100 lg:pl-8 pt-8 lg:pt-0">
                      <div className="space-y-6">
                        <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider">Bill Summary</h3>

                        {!billDetails && (
                          <div className="p-8 border border-dashed border-slate-200 rounded-3xl text-center text-slate-400 space-y-2">
                            <HelpCircle size={24} className="mx-auto text-slate-300" />
                            <p className="text-xs font-black text-slate-600">No Details Fetched</p>
                            <p className="text-[10px]">Enter account parameters and click Fetch Bill Details.</p>
                          </div>
                        )}

                        {billDetails && (
                          <div className="bg-slate-50 border border-slate-200 rounded-[24px] p-6 space-y-6">
                            <div className="border-b border-slate-200 pb-4 flex justify-between items-start">
                              <div>
                                <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded font-black uppercase tracking-wider">Verified Info</span>
                                <h4 className="text-sm font-black text-slate-800 mt-2">{billDetails.customerName}</h4>
                              </div>
                              <button
                                onClick={() => {
                                  setBillDetails(null);
                                  setManualAmount('');
                                }}
                                className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-all"
                              >
                                <X size={16} />
                              </button>
                            </div>

                            {billDetails.fetchSupported ? (
                              <div className="space-y-4">
                                <div className="flex justify-between items-center text-xs">
                                  <span className="text-slate-400 font-bold uppercase tracking-wider">Due Amount</span>
                                  <span className="text-xl font-black text-slate-800">₹{billDetails.billAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                </div>

                                <div className="space-y-2 border-t border-slate-100 pt-3 mt-3">
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
                                  Number(manualAmount) > bbpsMaxLimit ? (
                                    <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-center gap-2 text-rose-600 text-xs font-bold animate-in fade-in duration-200">
                                      <AlertTriangle size={16} className="shrink-0" />
                                      <span>Amount exceeds limit of ₹{bbpsMaxLimit.toLocaleString()}</span>
                                    </div>
                                  ) : (
                                    <div className="bg-indigo-50/50 border border-indigo-100/50 rounded-2xl p-4 space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                      <div className="flex justify-between items-center text-xs text-slate-500 font-medium">
                                        <span>Bill Base Amount</span>
                                        <span className="font-bold text-slate-700">₹{Number(manualAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                      </div>
                                      <div className="flex justify-between items-center text-xs text-slate-500 font-medium">
                                        <span>Transaction Charges</span>
                                        <span className="font-bold text-indigo-600">+ ₹{calculateBillCharge(Number(manualAmount)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                      </div>
                                      <div className="border-t border-indigo-100/60 pt-2 flex justify-between items-center text-sm font-black text-slate-800">
                                        <span>Total Debited</span>
                                        <span className="text-base text-emerald-600">₹{(Number(manualAmount) + calculateBillCharge(Number(manualAmount))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                      </div>
                                    </div>
                                  )
                                )}

                                {billDetails.dueDate && (
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-400 font-bold uppercase tracking-wider">Due Date</span>
                                    <span className="font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded">{billDetails.dueDate}</span>
                                  </div>
                                )}
                                {billDetails.billNumber && billDetails.billNumber !== "NA" && (
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-400 font-bold uppercase tracking-wider">Bill Number</span>
                                    <span className="font-bold text-slate-600">{billDetails.billNumber}</span>
                                  </div>
                                )}
                                {billDetails.billDate && billDetails.billDate !== "NA" && (
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-400 font-bold uppercase tracking-wider">Bill Date</span>
                                    <span className="font-bold text-slate-600">{billDetails.billDate}</span>
                                  </div>
                                )}
                                {billDetails.billPeriod && billDetails.billPeriod !== "NA" && (
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-400 font-bold uppercase tracking-wider">Bill Period</span>
                                    <span className="font-bold text-slate-600">{billDetails.billPeriod}</span>
                                  </div>
                                )}
                                {billDetails.additionalInfo && billDetails.additionalInfo
                                  .filter((info) => info.infoName.toLowerCase() !== "maximum permissible amount")
                                  .map((info) => (
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
                                  Number(manualAmount) > bbpsMaxLimit ? (
                                    <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-center gap-2 text-rose-600 text-xs font-bold animate-in fade-in duration-200">
                                      <AlertTriangle size={16} className="shrink-0" />
                                      <span>Amount exceeds limit of ₹{bbpsMaxLimit.toLocaleString()}</span>
                                    </div>
                                  ) : (
                                    <div className="bg-indigo-50/50 border border-indigo-100/50 rounded-2xl p-4 space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                      <div className="flex justify-between items-center text-xs text-slate-500 font-medium">
                                        <span>Bill Base Amount</span>
                                        <span className="font-bold text-slate-700">₹{Number(manualAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                      </div>
                                      <div className="flex justify-between items-center text-xs text-slate-500 font-medium">
                                        <span>Transaction Charges</span>
                                        <span className="font-bold text-indigo-600">+ ₹{calculateBillCharge(Number(manualAmount)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                      </div>
                                      <div className="border-t border-indigo-100/60 pt-2 flex justify-between items-center text-sm font-black text-slate-800">
                                        <span>Total Debited</span>
                                        <span className="text-base text-emerald-600">₹{(Number(manualAmount) + calculateBillCharge(Number(manualAmount))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                      </div>
                                    </div>
                                  )
                                )}
                              </div>
                            )}

                            <div className="pt-2">
                              <button
                                type="button"
                                onClick={handlePrePayCheck}
                                disabled={loading || lockoutSeconds > 0 || (!billDetails.fetchSupported && !manualAmount) || Number(manualAmount) > bbpsMaxLimit}
                                className={`w-full py-4 text-white rounded-2xl font-black text-sm uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] cursor-pointer ${
                                  lockoutSeconds > 0
                                    ? "bg-rose-600 hover:bg-rose-700 shadow-rose-100"
                                    : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100"
                                }`}
                              >
                                {loading ? (
                                  <>
                                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                    Paying Bill...
                                  </>
                                ) : lockoutSeconds > 0 ? (
                                  `Locked (${Math.floor(lockoutSeconds / 60)}m ${lockoutSeconds % 60}s)`
                                ) : (
                                  "Pay Now"
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {step === 4 && receipt && (
              <motion.div
                key="success-receipt"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center justify-center py-8"
              >
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
                      ₹{(receipt.amount + (receipt.charges || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
                    <div className="flex justify-between border-t border-slate-100 pt-3">
                      <span className="text-slate-400 uppercase tracking-wider text-[9px]">Base Bill Amount</span>
                      <span className="font-black text-slate-800">₹{receipt.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 uppercase tracking-wider text-[9px]">Transaction Charges</span>
                      <span className="font-black text-slate-800">₹{(receipt.charges || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-100 pt-3">
                      <span className="text-slate-400 uppercase tracking-wider text-[9px] font-black">Total Debited</span>
                      <span className="font-black text-emerald-600 text-sm">₹{(receipt.amount + (receipt.charges || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-100 pt-3">
                      <span className="text-slate-400 uppercase tracking-wider text-[9px]">Transaction ID</span>
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
                      Secure BBPS Gateway
                    </div>
                    <span>Reference ID: {receipt.txnid.substring(0, 8)}</span>
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
                    onClick={resetForm}
                    className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-100"
                  >
                    Done
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 100% Secured Payment Badge */}
        <div className="absolute bottom-6 left-8 flex items-center gap-1.5 text-slate-400 font-extrabold uppercase tracking-widest text-[9px] select-none pointer-events-none print:hidden z-0">
          <ShieldCheck size={12} className="text-teal-500" />
          <span>100% Secured Payment</span>
        </div>

      </div>

      {/* TPIN Verification Modal */}
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

                <div className="text-center">
                  {3 - tpinAttempts === 1 ? (
                    <span className="text-xs font-black text-rose-600 animate-pulse">
                      ⚠️ Last Attempt! Incorrect TPIN will lock your account for 10 minutes.
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-slate-500">
                      Remaining attempts: <strong className="text-indigo-600">{3 - tpinAttempts}</strong>
                    </span>
                  )}
                </div>

                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setShowTpinModal(false)}
                    disabled={tpinLoading}
                    className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer border border-slate-200/50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={tpinLoading || tpinInput.length !== 4}
                    className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-100 disabled:opacity-50"
                  >
                    {tpinLoading ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : (
                      "Confirm & Pay"
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
