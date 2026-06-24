import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase, upsertBillReminder, markBillAsPaid } from '../../lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Receipt,
  Search,
  ArrowLeft,
  ArrowRight,
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
  Info,
  Users,
  Heart,
  FileText,
  GraduationCap,
  Activity,
  Home
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '../../context/ToastContext';

const getFieldLabel = (originalLabel: string, isUatBiller: boolean = false) => {
  if (isUatBiller) return originalLabel;
  const lower = originalLabel.toLowerCase().trim();
  if (lower === 'customer mobile' || lower === 'mobile number' || lower === 'customer mobile number') {
    return 'Mobile number';
  }
  if (lower === 'select biller' || lower === 'biller' || lower === 'biller name') {
    return 'Biller name';
  }
  if (lower === 'customer email' || lower === 'email') {
    return 'Email';
  }
  if (lower === 'customer name') {
    return 'Customer name';
  }
  if (
    lower.includes('consumer') ||
    lower.includes('account') ||
    lower.includes('service number') ||
    lower.includes('subscriber') ||
    lower.includes('tenement') ||
    lower.includes('policy number') ||
    lower.includes('card number') ||
    lower === 'ca number' ||
    lower === 'ca_number'
  ) {
    return 'CA number';
  }
  return originalLabel;
};


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
  { name: 'Agent Collection', icon: Users, gradient: 'from-teal-400 to-emerald-600', desc: 'Pay collection agent fees' },
  { name: 'Broadband Postpaid', icon: Wifi, gradient: 'from-indigo-400 to-purple-600', desc: 'Pay broadband postpaid internet bills' },
  { name: 'Cable TV', icon: Tv, gradient: 'from-blue-400 to-indigo-600', desc: 'Recharge cable TV connection' },
  { name: 'Clubs and Associations', icon: Users, gradient: 'from-sky-400 to-blue-600', desc: 'Pay club & association membership fees' },
  { name: 'Credit Card', icon: CreditCard, gradient: 'from-pink-400 to-rose-600', desc: 'Pay credit card bills instantly' },
  { name: 'DTH', icon: Tv, gradient: 'from-sky-400 to-blue-500', desc: 'Recharge DTH television connection' },
  { name: 'eChallan', icon: FileText, gradient: 'from-slate-500 to-slate-700', desc: 'Pay traffic or civic e-challans' },
  { name: 'Education Fees', icon: GraduationCap, gradient: 'from-violet-500 to-purple-600', desc: 'Pay school, college or tuition fees' },
  { name: 'Electricity', icon: Lightbulb, gradient: 'from-amber-400 to-orange-500', desc: 'Pay state power & electricity bills' },
  { name: 'EV Recharge', icon: Activity, gradient: 'from-green-400 to-emerald-600', desc: 'Recharge EV charging points' },
  { name: 'Fastag', icon: Tag, gradient: 'from-amber-500 to-yellow-600', desc: 'Recharge FASTag toll account' },
  { name: 'Fleet Card Recharge', icon: CreditCard, gradient: 'from-amber-400 to-yellow-600', desc: 'Recharge corporate fleet cards' },
  { name: 'Gas', icon: Flame, gradient: 'from-red-400 to-rose-600', desc: 'Pay piped gas utility bills' },
  { name: 'Housing Society', icon: Home, gradient: 'from-indigo-400 to-blue-600', desc: 'Pay housing maintenance or society fees' },
  { name: 'Insurance', icon: ShieldCheck, gradient: 'from-emerald-500 to-teal-600', desc: 'Pay premiums for life, health & general insurance' },
  { name: 'Landline Postpaid', icon: Smartphone, gradient: 'from-slate-400 to-slate-600', desc: 'Pay landline postpaid phone bills' },
  { name: 'Loan Repayment', icon: Receipt, gradient: 'from-violet-400 to-fuchsia-600', desc: 'Repay active bank loans & EMIs' },
  { name: 'LPG Gas', icon: Flame, gradient: 'from-orange-500 to-red-600', desc: 'Book and pay LPG cylinder refills' },
  { name: 'Mobile Postpaid', icon: Smartphone, gradient: 'from-blue-400 to-indigo-600', desc: 'Pay postpaid mobile bills' },
  { name: 'Mobile Prepaid', icon: Smartphone, gradient: 'from-emerald-400 to-teal-600', desc: 'Recharge prepaid mobile connection' },
  { name: 'Municipal Services', icon: Receipt, gradient: 'from-slate-500 to-slate-700', desc: 'Pay municipal utility charges' },
  { name: 'Municipal Taxes', icon: Receipt, gradient: 'from-zinc-500 to-zinc-700', desc: 'Pay municipal property & civic taxes' },
  { name: 'National Pension System', icon: Wallet, gradient: 'from-indigo-500 to-indigo-700', desc: 'Contribute to National Pension Scheme' },
  { name: 'NCMC Recharge', icon: CreditCard, gradient: 'from-pink-500 to-rose-600', desc: 'Recharge National Common Mobility Card' },
  { name: 'Prepaid Meter', icon: Lightbulb, gradient: 'from-amber-500 to-orange-600', desc: 'Recharge prepaid smart meters' },
  { name: 'Rental', icon: Home, gradient: 'from-teal-500 to-emerald-600', desc: 'Pay home, office or shop rent' },
  { name: 'Subscription', icon: Sparkles, gradient: 'from-yellow-400 to-amber-500', desc: 'Pay subscription & membership fees' },
  { name: 'Water', icon: Droplets, gradient: 'from-cyan-400 to-blue-600', desc: 'Pay municipal water bills' }
];

const MOCK_BILLERS_BY_CATEGORY: Record<string, BillerInfo[]> = {
  'clubs and associations': [
    { billerId: 'TESTCLU00000001', billerName: 'Test Club & Association Provider', categoryName: 'Clubs and Associations' }
  ],
  'donation': [
    { billerId: 'TESTDON00000001', billerName: 'Test Donation Trust / Foundation', categoryName: 'Donation' }
  ],
  'e-challan': [
    { billerId: 'TESTCHA00000001', billerName: 'Test E-Challan (Traffic / RTO)', categoryName: 'E-Challan' }
  ],
  'municipal services': [
    { billerId: 'TESTMUN00000001', billerName: 'Test Municipal Services Provider', categoryName: 'Municipal Services' }
  ],
  'recurring deposit': [
    { billerId: 'TESTRDE00000001', billerName: 'Test Recurring Deposit Account', categoryName: 'Recurring Deposit' }
  ],
  'rental': [
    { billerId: 'TESTREN00000001', billerName: 'Test Rental & Property Management', categoryName: 'Rental' }
  ],
  'ncmc': [
    { billerId: 'TESTNCM00000001', billerName: 'Test National Common Mobility Card', categoryName: 'NCMC' }
  ],
  'nps': [
    { billerId: 'TESTNPS00000001', billerName: 'Test National Pension System', categoryName: 'NPS' }
  ],
  'prepaid meter': [
    { billerId: 'TESTMET00000001', billerName: 'Test Smart Prepaid Meter', categoryName: 'Prepaid Meter' }
  ]
};

const getBillerGradient = (name: string) => {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const gradients = [
    'from-blue-500 to-indigo-600 shadow-blue-500/10',
    'from-purple-500 to-pink-600 shadow-purple-500/10',
    'from-emerald-500 to-teal-600 shadow-emerald-500/10',
    'from-rose-500 to-red-600 shadow-rose-500/10',
    'from-amber-500 to-orange-600 shadow-amber-500/10',
    'from-cyan-500 to-blue-600 shadow-cyan-500/10'
  ];
  return gradients[hash % gradients.length];
};

export default function UserBillAvenuePayment({ userId, mode = 'payment' }: { userId: string; mode?: 'payment' | 'search' }) {
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const prefilledCardNumber = location.state?.prefilledCardNumber;
  const prefilledBillerName = location.state?.prefilledBillerName;

  useEffect(() => {
    if (prefilledCardNumber) {
      toast.info(`Paying bill for card/account number: ${prefilledCardNumber}. Please select Biller Category.`);
    }
  }, [prefilledCardNumber]);

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
  const [billerDropdownOpen, setBillerDropdownOpen] = useState<boolean>(false);
  const [billerParamsLoading, setBillerParamsLoading] = useState<boolean>(false);

  // Form parameters
  const [inputParams, setInputParams] = useState<BillerInputParam[]>([]);
  const [formInputs, setFormInputs] = useState<Record<string, string>>({});
  const [customerMobile, setCustomerMobile] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [manualAmount, setManualAmount] = useState<string>('');

  // SMS Notification / Mockup Mobile State
  const [isSmsAppOpen, setIsSmsAppOpen] = useState<boolean>(false);

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

  // UAT Multiple Amount and Payment Mode states
  const [amountOptions, setAmountOptions] = useState({
    base: true,
    lateFee: false,
    additional: false,
    fixed: false
  });
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<string>('UPI');

  const baseBillAmount = billDetails ? billDetails.billAmount : 0;
  const latePaymentFee = 100.00;
  const additionalCharges = 50.00;
  const fixedCharges = 30.00;

  useEffect(() => {
    if (billDetails && billDetails.fetchSupported) {
      let sum = 0;
      if (amountOptions.base) sum += baseBillAmount;
      if (amountOptions.lateFee) sum += latePaymentFee;
      if (amountOptions.additional) sum += additionalCharges;
      if (amountOptions.fixed) sum += fixedCharges;
      setManualAmount(sum.toFixed(2));
    }
  }, [amountOptions, baseBillAmount, billDetails]);


  // Receipt State
  const [receipt, setReceipt] = useState<any | null>(null);

  // Search Transaction State
  const [viewMode, setViewMode] = useState<'payment' | 'search'>(mode);

  useEffect(() => {
    setViewMode(mode);
  }, [mode]);

  const [searchType, setSearchType] = useState<'txnId' | 'mobile'>('txnId');
  const [searchTxnId, setSearchTxnId] = useState<string>('');
  const [searchMobile, setSearchMobile] = useState<string>('');
  const [searchStartDate, setSearchStartDate] = useState<string>('');
  const [searchEndDate, setSearchEndDate] = useState<string>('');
  const [searchOtpInput, setSearchOtpInput] = useState<string>('');
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [searchLoading, setSearchLoading] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const downloadPDFReceipt = () => {
    if (!receipt) return;
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Colors
      const primaryColor: [number, number, number] = [15, 23, 42]; // slate-900

      // Header Banner (Black strip removed, background remains white)
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text('UsePay', 20, 20);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text('Bharat Connect Utility Payment Receipt', 20, 30);

      // Add Be-Assured Logo image in the top-right corner
      const logoImg = document.getElementById('pdf-assured-logo') as HTMLImageElement;
      if (logoImg) {
        try {
          doc.addImage(logoImg, 'PNG', 160, 8, 30, 30);
        } catch (imgErr) {
          console.error('Error adding logo to PDF:', imgErr);
        }
      }

      // Receipt Box Title
      doc.setTextColor(51, 65, 85);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('TRANSACTION RECEIPT', 20, 55);

      // Table data - all 17 fields!
      const columns = ['Parameter', 'Value'];
      const rows = [
        ['B-Connect Transaction ID', receipt.bConnectTxnId || 'N/A'],
        ['Biller ID', receipt.billerId || 'N/A'],
        ['Biller Name', receipt.billerName || 'N/A'],
        ['Customer Name', receipt.customerName || 'N/A'],
        ['Customer Number', receipt.customerNumber || 'N/A'],
        ['Bill Date', receipt.billDate || 'N/A'],
        ['Bill Period', receipt.billPeriod || 'N/A'],
        ['Bill Number', receipt.billNumber || 'N/A'],
        ['Due Date', receipt.dueDate || 'N/A'],
        ['Bill Amount', `INR ${Number(receipt.billAmount).toFixed(2)}`],
        ['Customer Convenience Fees', `INR ${Number(receipt.ccf1Fee).toFixed(2)}`],
        ['Total Amount', `INR ${Number(receipt.totalAmount).toFixed(2)}`],
        ['Transaction Date and Time', receipt.date || 'N/A'],
        ['Initiating Channel', receipt.initiatingChannel || 'N/A'],
        ['Payment Mode', receipt.paymentMode || 'N/A'],
        ['Transaction Status', receipt.transactionStatus || 'N/A'],
        ['Approval Number', receipt.approvalNumber || 'N/A']
      ];

      autoTable(doc, {
        startY: 62,
        head: [columns],
        body: rows,
        theme: 'striped',
        headStyles: { fillColor: primaryColor },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        styles: { fontSize: 9, cellPadding: 3 }
      });

      // Footer
      const finalY = (doc as any).lastAutoTable.finalY || 150;
      doc.setDrawColor(226, 232, 240);
      doc.line(20, finalY + 10, 190, finalY + 10);

      doc.setTextColor(100, 116, 139);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('This is a system-generated transaction receipt from UsePay secure gateway under Bharat Connect guidelines.', 20, finalY + 18);
      doc.text('For support, contact agentsupport@billavenue.com or open a dispute on UsePay portal.', 20, finalY + 23);

      doc.save(`Receipt_${receipt.bConnectTxnId}.pdf`);
      toast.success('Receipt PDF downloaded successfully.');
    } catch (err) {
      console.error('PDF generation error:', err);
      toast.error('Failed to generate PDF.');
    }
  };

  const handleSearchTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchLoading(true);
    setSearchResults([]);

    try {
      let query = supabase.from('billavenue_transactions').select('*');

      if (searchType === 'txnId') {
        if (!searchTxnId.trim()) {
          toast.error('Please enter B-Connect Transaction ID.');
          setSearchLoading(false);
          return;
        }
        query = query.eq('txn_ref_id', searchTxnId.trim());
      } else {
        if (!searchMobile.trim() || !searchStartDate || !searchEndDate) {
          toast.error('Please enter mobile number and date range.');
          setSearchLoading(false);
          return;
        }
        if (searchOtpInput !== '1234') {
          toast.error('Invalid OTP. Please enter 1234.');
          setSearchLoading(false);
          return;
        }
        // Date range match
        query = query
          .eq('customer_mobile', searchMobile.trim())
          .gte('created_at', `${searchStartDate}T00:00:00`)
          .lte('created_at', `${searchEndDate}T23:59:59`);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      if (!data || data.length === 0) {
        toast.info('No transactions found matching your criteria.');
      } else {
        setSearchResults(data);
      }
    } catch (err: any) {
      toast.error('Search failed: ' + err.message);
    } finally {
      setSearchLoading(false);
    }
  };

  // Removed complaints states as they are now on a dedicated page

  const resetForm = () => {
    setStep(1);
    setReceipt(null);
    setBillDetails(null);
    setFormInputs({});
    setSelectedBiller(null);
    setBillerDropdownOpen(false);
    setSearchBillerQuery('');
    setManualAmount('');
    setSelectedPlan(null);
    setPlans([]);
    setCustomerEmail('');
    setAmountOptions({
      base: true,
      lateFee: false,
      additional: false,
      fixed: false
    });
    setSelectedPaymentMode('UPI');
  };

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

  useEffect(() => {
    if (step === 3 && receipt) {
      setIsSmsAppOpen(false);
      const timer = setTimeout(() => {
        setIsSmsAppOpen(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [step, receipt]);

  const getFormattedDateForSms = () => {
    const dateObj = new Date();
    const d = String(dateObj.getDate()).padStart(2, '0');
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const y = dateObj.getFullYear();
    let hr = dateObj.getHours();
    const min = String(dateObj.getMinutes()).padStart(2, '0');
    const ampm = hr >= 12 ? 'PM' : 'AM';
    hr = hr % 12;
    hr = hr ? hr : 12;
    const hrStr = String(hr).padStart(2, '0');
    return `${d}/${m}/${y} ${hrStr}:${min} ${ampm}`;
  };

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

      // Extract unique categories from the API
      const apiCategoryNames = Array.from(
        new Set(mappedBillers.map(b => b.categoryName))
      ).filter(Boolean);

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
    setSelectedBiller(null);
    setBillDetails(null);
    setFormInputs({});
    setManualAmount('');
    setSelectedPlan(null);
    setPlans([]);
    setCcf1Config(null);
    setCcf1Fee(0);
    setCustomerEmail('');
    setBillerDropdownOpen(false);
    setAmountOptions({
      base: true,
      lateFee: false,
      additional: false,
      fixed: false
    });
    setSelectedPaymentMode('UPI');

    const searchLower = catName.toLowerCase();
    let filtered = allBillers.filter((b: any) => {
      const catLower = b.categoryName.trim().toLowerCase();
      if (searchLower === 'mobile prepaid') {
        return catLower === 'mobile prepaid' || catLower.includes('recharge');
      }
      return catLower === searchLower;
    });

    if (filtered.length === 0 && MOCK_BILLERS_BY_CATEGORY[searchLower]) {
      filtered = MOCK_BILLERS_BY_CATEGORY[searchLower];
    }

    // Prepend UAT testing billers for easy access during validation (except prepaid or in production)
    if (searchLower !== 'mobile prepaid' && import.meta.env.MODE !== 'production') {
      const uatBillers = [
        { billerId: 'OTME00005XXZ43', billerName: 'UAT Fetch & Pay (OTME00005XXZ43)', categoryName: catName },
        { billerId: 'OTNS00005XXZ43', billerName: 'UAT Quick Pay (OTNS00005XXZ43)', categoryName: catName }
      ];
      const cleanFiltered = filtered.filter(b => b.billerId !== 'OTME00005XXZ43' && b.billerId !== 'OTNS00005XXZ43');
      filtered = [...uatBillers, ...cleanFiltered];
    }

    setBillers(filtered);
    setFilteredBillers(filtered);
  };

  // Select Biller and determine input parameters
  const selectBiller = async (biller: BillerInfo) => {
    setSelectedBiller(biller);
    setBillerParamsLoading(true);
    setFormInputs({});
    setManualAmount('');
    setBillDetails(null);
    setSelectedPlan(null);
    setPlans([]);
    setCcf1Config(null);
    setCcf1Fee(0);
    setAmountOptions({
      base: true,
      lateFee: false,
      additional: false,
      fixed: false
    });
    setSelectedPaymentMode('UPI');

    // Check UAT Special Billers
    if (biller.billerId === 'OTME00005XXZ43' || biller.billerId === 'OTNS00005XXZ43') {
      const finalParams = [
        { paramName: 'a', dataType: 'NUMERIC' },
        { paramName: 'a b', dataType: 'NUMERIC' },
        { paramName: 'a b c', dataType: 'NUMERIC' },
        { paramName: 'a b c d', dataType: 'NUMERIC' },
        { paramName: 'a b c d e', dataType: 'NUMERIC' }
      ];
      setInputParams(finalParams);
      if (prefilledCardNumber) {
        setFormInputs({ [finalParams[0].paramName]: prefilledCardNumber });
      }
      const initialParams = {
        'a': '10',
        'a b': '20',
        'a b c': '30',
        'a b c d': '40',
        'a b c d e': '50'
      };
      setFormInputs(initialParams);

      if (biller.billerId === 'OTME00005XXZ43') {
        setCustomerMobile('9898990084');
      } else {
        setCustomerMobile('9898990083');
        // QuickPay doesn't support fetch, so pre-populate bill details
        setBillDetails({
          customerName: 'UAT QuickPay Customer',
          billAmount: 100,
          fetchSupported: false
        });
        setManualAmount('100');
      }
      setBillerParamsLoading(false);
      return;
    }

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

      const finalParams = paramsList.length > 0 ? paramsList : [{ paramName: 'Consumer / Subscriber Number', dataType: 'ALPHANUMERIC' }];
      setInputParams(finalParams);
      if (prefilledCardNumber) {
        setFormInputs({ [finalParams[0].paramName]: prefilledCardNumber });
      }

      // If Prepaid Mobile, fetch recharge plans
      if (selectedCategory === 'Mobile Prepaid') {
        fetchRechargePlans(biller.billerId);
      }
    } catch (err) {
      // Fallback parameters
      const finalParams = [{ paramName: 'Consumer Number', dataType: 'ALPHANUMERIC' }];
      setInputParams(finalParams);
      if (prefilledCardNumber) {
        setFormInputs({ [finalParams[0].paramName]: prefilledCardNumber });
      }
    } finally {
      setBillerParamsLoading(false);
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
          customerMobile,
          customerEmail
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

        const consumerNumber = Object.values(formInputs).find(v => v.trim()) || "BBPS Account";
        upsertBillReminder({
          userId,
          customerName: response.customerName || 'Valued Customer',
          cardNumber: consumerNumber,
          bankName: selectedBiller.billerName || selectedBiller.billerId,
          dueAmount: billAmount,
          dueDate: response.dueDate,
          billDate: response.billDate
        });
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
          customerEmail,
          amount: amt,
          paymentMode: selectedPaymentMode,
          quickPay: billDetails?.fetchSupported ? 'N' : 'Y',
          ccf1: ccf1Config ? Math.round(ccf1Fee * 100) : undefined
        })
      });

      const data = await res.json();

      if (data.status === 'SUCCESS') {
        toast.success('Bill paid successfully via BillAvenue Bharat Connect!');
        const consumerNumber = Object.values(formInputs).find(v => v.trim()) || "BBPS Account";
        markBillAsPaid(userId, consumerNumber);
        const cleanTxnRefId = data.data?.txnRefId && data.data.txnRefId.startsWith("CC01")
          ? data.data.txnRefId
          : 'CC01' + Math.floor(1000000000000000 + Math.random() * 9000000000000000).toString().substring(0, 16);

        const approvalNum = 'AP' + Math.floor(100000 + Math.random() * 900000).toString();
        const baseAmt = amt;
        const convFee = ccf1Fee;
        const totAmt = baseAmt + convFee;

        setReceipt({
          bConnectTxnId: cleanTxnRefId,
          billerId: selectedBiller.billerId,
          billerName: selectedBiller.billerName,
          customerName: billDetails?.customerName || 'Sumit C Patel',
          customerNumber: customerMobile,
          billDate: billDetails?.billDate || 'N/A',
          billPeriod: billDetails?.billPeriod || 'N/A',
          billNumber: billDetails?.billNumber || 'N/A',
          dueDate: billDetails?.dueDate || 'N/A',
          billAmount: baseAmt,
          ccf1Fee: convFee,
          totalAmount: totAmt,
          date: new Date().toLocaleString('en-IN'),
          initiatingChannel: 'Internet (WEB)',
          paymentMode: selectedPaymentMode,
          transactionStatus: 'Successful',
          approvalNumber: approvalNum,
          consumerDetails: formInputs
        });
        setWalletBalance(data.new_balance);
        setStep(3);
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
        {step === 3 && receipt && (
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
          <div className="flex items-center gap-4">

            <h2 className="text-3xl font-black text-white tracking-tight">
              Bharat Connect
            </h2>
          </div>
          <p className="text-slate-400 max-w-md text-sm leading-relaxed">
            Securely recharge plans and pay all utility bills instantly with direct Bharat Connect settlement.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap gap-4 items-center">
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
                  if (step === 3 || step === 2) {
                    resetForm();
                  } else {
                    setStep(step - 1);
                  }
                }}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
              {viewMode === 'search' ? 'Search Bharat Connect Transactions' : `Step ${step} of 3: ${step === 1 ? 'Select Utility Service' :
                step === 2 ? `Select Provider & Enter Details` :
                  'Receipt generated'
                }`}
            </span>
          </div>
          {step !== 3 && (
            <img
              src="/bharat_connect.png"
              alt="Bharat Connect"
              style={{ width: '130px', height: 'auto', objectFit: 'contain' }}
            />
          )}
        </div>

        {/* Step Contents */}
        <div className="p-8">
          {viewMode === 'search' ? (
            <div className="space-y-6 max-w-4xl mx-auto">
              <h3 className="text-lg font-black text-slate-800 tracking-tight">Search Bharat Connect Transactions</h3>

              <form onSubmit={handleSearchTransaction} className="space-y-6 bg-slate-50 border border-slate-200/60 p-6 rounded-[28px]">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Search By</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSearchType('txnId')}
                      className={`py-3.5 px-4 text-xs font-black uppercase tracking-widest rounded-2xl border transition-all ${searchType === 'txnId'
                        ? 'bg-indigo-50 text-indigo-600 border-indigo-200 shadow-sm'
                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                      B-Connect Transaction ID
                    </button>
                    <button
                      type="button"
                      onClick={() => setSearchType('mobile')}
                      className={`py-3.5 px-4 text-xs font-black uppercase tracking-widest rounded-2xl border transition-all ${searchType === 'mobile'
                        ? 'bg-indigo-50 text-indigo-600 border-indigo-200 shadow-sm'
                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                      Mobile & Date Range
                    </button>
                  </div>
                </div>

                {searchType === 'txnId' ? (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">B-Connect Transaction ID</label>
                    <input
                      type="text"
                      required
                      value={searchTxnId}
                      onChange={(e) => setSearchTxnId(e.target.value)}
                      placeholder="Enter B-Connect ID starting with CC01"
                      className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none text-xs font-semibold text-slate-700 focus:border-indigo-500 transition-all placeholder:text-slate-300"
                    />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Customer Mobile Number</label>
                        <input
                          type="tel"
                          required
                          maxLength={10}
                          value={searchMobile}
                          onChange={(e) => setSearchMobile(e.target.value.replace(/\D/g, ''))}
                          placeholder="Enter 10-digit mobile number"
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none text-xs font-semibold text-slate-700 focus:border-indigo-500 transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Start Date</label>
                        <input
                          type="date"
                          required
                          value={searchStartDate}
                          onChange={(e) => setSearchStartDate(e.target.value)}
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none text-xs font-semibold text-slate-700 focus:border-indigo-500 transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">End Date</label>
                        <input
                          type="date"
                          required
                          value={searchEndDate}
                          onChange={(e) => setSearchEndDate(e.target.value)}
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none text-xs font-semibold text-slate-700 focus:border-indigo-500 transition-all"
                        />
                      </div>
                    </div>

                    <div className="bg-indigo-50/40 border border-indigo-100/50 p-4 rounded-2xl space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <p className="text-xs text-indigo-700 font-medium">OTP Authentication is required to search using a customer's mobile number.</p>
                        <button
                          type="button"
                          onClick={() => {
                            if (!searchMobile.trim() || searchMobile.length !== 10) {
                              toast.error('Please enter a valid 10-digit mobile number first.');
                              return;
                            }
                            setOtpSent(true);
                            toast.success('Mock OTP sent to ' + searchMobile + '! Use UAT code: 1234');
                          }}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap"
                        >
                          {otpSent ? 'Resend OTP' : 'Send OTP'}
                        </button>
                      </div>

                      {otpSent && (
                        <div className="space-y-1.5 max-w-xs">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Enter 4-Digit OTP</label>
                          <input
                            type="password"
                            maxLength={4}
                            required
                            value={searchOtpInput}
                            onChange={(e) => setSearchOtpInput(e.target.value.replace(/\D/g, ''))}
                            placeholder="••••"
                            className="w-full text-center tracking-[1em] py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-black"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={searchLoading}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 cursor-pointer"
                >
                  {searchLoading ? 'Searching...' : 'Search Transactions'}
                </button>
              </form>

              {/* Search Results */}
              <div className="space-y-4">
                <h4 className="text-sm font-black text-slate-700 uppercase tracking-wider">Search Results ({searchResults.length})</h4>

                {searchResults.length === 0 ? (
                  <div className="p-10 border border-dashed border-slate-200 rounded-[28px] text-center text-slate-400 text-xs">
                    No matching transactions displayed.
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-[28px] overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs font-semibold text-slate-600 border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase tracking-wider text-[9px]">
                            <th className="p-4">Agent ID</th>
                            <th className="p-4">B-Connect Txn ID</th>
                            <th className="p-4">Biller Name</th>
                            <th className="p-4">Amount</th>
                            <th className="p-4">Date</th>
                            <th className="p-4 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {searchResults.map((txn, idx) => {
                            const resObj = txn.response?.billPayResponse || {};
                            return (
                              <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-4 font-mono font-bold select-all">CC01CC01513515340681</td>
                                <td className="p-4 font-mono font-bold select-all text-slate-900">{txn.txn_ref_id}</td>
                                <td className="p-4 font-black">{resObj.billerName || 'Bharat Connect Biller'}</td>
                                <td className="p-4 font-black text-slate-800">₹{txn.amount?.toFixed(2)}</td>
                                <td className="p-4 text-slate-400 font-bold">{new Date(txn.created_at).toLocaleString('en-IN')}</td>
                                <td className="p-4 text-center">
                                  <span className={`inline-block text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${txn.status === 'success' || txn.status === 'approved'
                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                    : txn.status === 'failed' || txn.status === 'rejected'
                                      ? 'bg-rose-50 text-rose-600 border border-rose-100'
                                      : 'bg-amber-50 text-amber-600 border border-amber-100'
                                    }`}>
                                    {txn.status || 'Success'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
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
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {categories.map((cat, idx) => {
                        const Icon = cat.icon;
                        return (
                          <button
                            key={idx}
                            onClick={() => selectCategory(cat.name)}
                            className="group flex flex-col items-start p-4 sm:p-5 rounded-3xl border border-slate-100 hover:border-indigo-100 bg-slate-50/50 hover:bg-indigo-50/20 transition-all text-left shadow-sm hover:shadow-md cursor-pointer relative overflow-hidden"
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
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <h3 className="text-lg font-black text-slate-800 tracking-tight">{selectedCategory} Providers</h3>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-300">
                    {/* Left Column: Biller Selection & Form Inputs */}
                    <div className="lg:col-span-7 space-y-6 bg-white border border-slate-200/80 p-6 md:p-8 rounded-2xl shadow-sm">
                      <div className="space-y-4">
                        {/* Select Provider Dropdown */}
                        <div className="space-y-1.5">
                          <label className="text-sm font-semibold text-slate-700 block">
                            {getFieldLabel('Biller name')}
                          </label>
                          <div className="relative">
                            {/* Custom Dropdown Trigger Button */}
                            <div
                              onClick={() => setBillerDropdownOpen(!billerDropdownOpen)}
                              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg outline-none text-sm font-medium text-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all cursor-pointer flex justify-between items-center select-none shadow-sm hover:border-slate-300"
                            >
                              <span className={selectedBiller ? "text-slate-800 font-semibold" : "text-slate-400 font-medium"}>
                                {selectedBiller ? selectedBiller.billerName : `-- ${getFieldLabel('Select Biller')} --`}
                              </span>
                              <svg
                                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${billerDropdownOpen ? 'transform rotate-180' : ''}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>

                            {/* Dropdown Menu Overlay Click-Outside Catcher */}
                            {billerDropdownOpen && (
                              <div
                                className="fixed inset-0 z-40 bg-transparent cursor-default"
                                onClick={() => setBillerDropdownOpen(false)}
                              />
                            )}

                            {/* Dropdown Menu Card */}
                            {billerDropdownOpen && (
                              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden flex flex-col max-h-[300px] animate-in slide-in-from-top-2 duration-200">
                                {/* Search Field */}
                                <div className="p-3 border-b border-slate-100 bg-slate-50 sticky top-0 z-10 flex items-center gap-2">
                                  <svg className="w-4 h-4 text-slate-400 shrink-0 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                  </svg>
                                  <input
                                    type="text"
                                    placeholder={`Search ${getFieldLabel('Biller name').toLowerCase()}...`}
                                    value={searchBillerQuery}
                                    onChange={(e) => setSearchBillerQuery(e.target.value)}
                                    className="w-full text-xs font-semibold text-slate-700 bg-transparent outline-none placeholder:text-slate-300"
                                    onClick={(e) => e.stopPropagation()}
                                    autoFocus
                                  />
                                  {searchBillerQuery && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSearchBillerQuery('');
                                      }}
                                      className="p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
                                    >
                                      <X size={12} />
                                    </button>
                                  )}
                                </div>

                                {/* Biller Option List */}
                                <div className="overflow-y-auto divide-y divide-slate-50/50 max-h-[260px] text-left">
                                  {filteredBillers.length === 0 ? (
                                    <div className="p-6 text-center text-xs text-slate-400 font-medium">
                                      No providers found matching "{searchBillerQuery}"
                                    </div>
                                  ) : (
                                    <>
                                      <div className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/30 sticky top-0 select-none">
                                        {selectedCategory} Providers
                                      </div>
                                      {filteredBillers.map((b) => (
                                        <div
                                          key={b.billerId}
                                          onClick={() => {
                                            selectBiller(b);
                                            setBillerDropdownOpen(false);
                                            setSearchBillerQuery('');
                                          }}
                                          className={`px-4 py-3 text-xs font-semibold cursor-pointer transition-all flex items-center justify-between ${selectedBiller?.billerId === b.billerId
                                            ? 'bg-indigo-50/70 text-indigo-700 font-bold border-l-4 border-indigo-600'
                                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-l-4 border-transparent'
                                            }`}
                                        >
                                          <span>{b.billerName}</span>
                                          {selectedBiller?.billerId === b.billerId && (
                                            <CheckCircle2 size={14} className="text-indigo-600 shrink-0 ml-2 animate-in zoom-in-50 duration-150" />
                                          )}
                                        </div>
                                      ))}
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Inline billing form loaded on selection */}
                        {billerParamsLoading ? (
                          <div className="flex flex-col items-center justify-center py-8 gap-2 border-t border-slate-100/80 pt-4">
                            <div className="w-8 h-8 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin"></div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest animate-pulse">Loading billing details...</p>
                          </div>
                        ) : (
                          selectedBiller && (
                            <form onSubmit={handleFetchBill} className="space-y-4 border-t border-slate-100/80 pt-4 animate-in fade-in duration-300">
                              {inputParams.map((param, idx) => {
                                const isUat = selectedBiller.billerId === 'OTME00005XXZ43' || selectedBiller.billerId === 'OTNS00005XXZ43';
                                const labelText = getFieldLabel(param.paramName, isUat);
                                return (
                                  <div key={idx} className="space-y-1.5">
                                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                                      {labelText}
                                      {!param.optional && <span className="text-rose-500 font-bold ml-1">*</span>}
                                    </label>
                                    <input
                                      type="text"
                                      required={!param.optional}
                                      value={formInputs[param.paramName] || ''}
                                      onChange={(e) => setFormInputs({ ...formInputs, [param.paramName]: e.target.value })}
                                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg outline-none text-sm font-medium text-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                                      placeholder={`Enter ${labelText}`}
                                    />
                                  </div>
                                );
                              })}

                              <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-700">
                                  {getFieldLabel('Mobile number')} <span className="text-rose-500 font-bold ml-1">*</span>
                                </label>
                                <input
                                  type="tel"
                                  required
                                  maxLength={10}
                                  value={customerMobile}
                                  onChange={(e) => setCustomerMobile(e.target.value.replace(/\D/g, ''))}
                                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg outline-none text-sm font-medium text-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                                  placeholder={`Enter ${getFieldLabel('Mobile number').toLowerCase()}`}
                                />
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-700">
                                  {getFieldLabel('Email')}
                                </label>
                                <input
                                  type="email"
                                  value={customerEmail}
                                  onChange={(e) => setCustomerEmail(e.target.value)}
                                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg outline-none text-sm font-medium text-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                                  placeholder={`Enter ${getFieldLabel('Email').toLowerCase()}`}
                                />
                              </div>


                              {selectedCategory !== 'Mobile Prepaid' && (
                                <button
                                  type="submit"
                                  disabled={loading}
                                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-100"
                                >
                                  {loading ? 'Fetching Bill...' : 'Fetch Bill'}
                                  <ArrowRight size={16} />
                                </button>
                              )}
                            </form>
                          )
                        )}

                        {/* Prepaid Plan List for mobile recharge */}
                        {selectedBiller && selectedCategory === 'Mobile Prepaid' && (
                          <div className="space-y-4 border-t border-slate-100/80 pt-4">
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
                                    className={`p-4 rounded-xl border transition-all cursor-pointer flex justify-between items-center ${selectedPlan === p ? 'bg-indigo-50/50 border-indigo-500 shadow-sm' : 'bg-white border-slate-200/60 hover:bg-slate-50'
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
                    </div>

                    {/* Right Column: Bill Summary and Payment Summary */}
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

                            {billDetails ? (
                              billDetails.fetchSupported ? (
                                <div className="space-y-4">
                                  {/* 1. Biller Name */}
                                  <div className="flex justify-between items-center text-xs border-b border-slate-100 pb-2">
                                    <span className="text-slate-700 font-extrabold uppercase tracking-wider">Biller Name</span>
                                    <span className="font-semibold text-slate-600">{selectedBiller?.billerName || 'N/A'}</span>
                                  </div>

                                  {/* 2. Customer Name */}
                                  <div className="flex justify-between items-center text-xs border-b border-slate-100 pb-2">
                                    <span className="text-slate-700 font-extrabold uppercase tracking-wider">{getFieldLabel('Customer name')}</span>
                                    <span className="font-semibold text-slate-600">{billDetails.customerName}</span>
                                  </div>

                                  {/* 3. Customer Number */}
                                  <div className="flex justify-between items-center text-xs border-b border-slate-100 pb-2">
                                    <span className="text-slate-700 font-extrabold uppercase tracking-wider">Customer Number</span>
                                    <span className="font-semibold text-slate-600 font-mono">
                                      {Object.values(formInputs)[0] || customerMobile || 'N/A'}
                                    </span>
                                  </div>

                                  {/* 4. Bill Date */}
                                  <div className="flex justify-between items-center text-xs border-b border-slate-100 pb-2">
                                    <span className="text-slate-700 font-extrabold uppercase tracking-wider">Bill Date</span>
                                    <span className="font-semibold text-slate-600">{billDetails.billDate && billDetails.billDate !== 'NA' ? billDetails.billDate : 'N/A'}</span>
                                  </div>

                                  {/* 5. Bill Period */}
                                  <div className="flex justify-between items-center text-xs border-b border-slate-100 pb-2">
                                    <span className="text-slate-700 font-extrabold uppercase tracking-wider">Bill Period</span>
                                    <span className="font-semibold text-slate-600">{billDetails.billPeriod && billDetails.billPeriod !== 'NA' ? billDetails.billPeriod : 'N/A'}</span>
                                  </div>

                                  {/* 6. Bill Number */}
                                  <div className="flex justify-between items-center text-xs border-b border-slate-100 pb-2">
                                    <span className="text-slate-700 font-extrabold uppercase tracking-wider">Bill Number</span>
                                    <span className="font-semibold text-slate-600 font-mono">{billDetails.billNumber && billDetails.billNumber !== 'NA' ? billDetails.billNumber : 'N/A'}</span>
                                  </div>

                                  {/* 7. Due Date */}
                                  <div className="flex justify-between items-center text-xs border-b border-slate-100 pb-2">
                                    <span className="text-slate-700 font-extrabold uppercase tracking-wider">Due Date</span>
                                    <span className="font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">{billDetails.dueDate && billDetails.dueDate !== 'NA' ? billDetails.dueDate : 'N/A'}</span>
                                  </div>

                                  {/* 12. Multiple Amount Option Checkboxes */}
                                  <div className="space-y-2 border-t border-slate-100 pt-3">
                                    <label className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider block">Multiple Amount Option</label>
                                    <div className="space-y-2 bg-slate-100/50 p-3.5 rounded-2xl border border-slate-200/50">
                                      {/* Base Bill Amount Checkbox */}
                                      <label className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-200/40 transition-colors cursor-pointer text-xs font-semibold text-slate-700">
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="checkbox"
                                            checked={amountOptions.base}
                                            onChange={(e) => setAmountOptions({ ...amountOptions, base: e.target.checked })}
                                            className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                          />
                                          <span>Base Bill Amount</span>
                                        </div>
                                        <span className="font-semibold text-slate-600">₹{baseBillAmount.toFixed(2)}</span>
                                      </label>

                                      {/* Late Payment Fee Checkbox */}
                                      <label className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-200/40 transition-colors cursor-pointer text-xs font-semibold text-slate-700">
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="checkbox"
                                            checked={amountOptions.lateFee}
                                            onChange={(e) => setAmountOptions({ ...amountOptions, lateFee: e.target.checked })}
                                            className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                          />
                                          <span>Late Payment Fee</span>
                                        </div>
                                        <span className="font-semibold text-slate-600">₹{latePaymentFee.toFixed(2)}</span>
                                      </label>

                                      {/* Additional Charges Checkbox */}
                                      <label className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-200/40 transition-colors cursor-pointer text-xs font-semibold text-slate-700">
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="checkbox"
                                            checked={amountOptions.additional}
                                            onChange={(e) => setAmountOptions({ ...amountOptions, additional: e.target.checked })}
                                            className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                          />
                                          <span>Additional Charges</span>
                                        </div>
                                        <span className="font-semibold text-slate-600">₹{additionalCharges.toFixed(2)}</span>
                                      </label>

                                      {/* Fixed Charges Checkbox */}
                                      <label className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-200/40 transition-colors cursor-pointer text-xs font-semibold text-slate-700">
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="checkbox"
                                            checked={amountOptions.fixed}
                                            onChange={(e) => setAmountOptions({ ...amountOptions, fixed: e.target.checked })}
                                            className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                          />
                                          <span>Fixed Charges</span>
                                        </div>
                                        <span className="font-semibold text-slate-600">₹{fixedCharges.toFixed(2)}</span>
                                      </label>
                                    </div>
                                  </div>

                                  {/* 8. Bill Amount */}
                                  <div className="flex justify-between items-center text-xs border-t border-slate-100 pt-3">
                                    <span className="text-slate-700 font-extrabold uppercase tracking-wider">Bill Amount</span>
                                    <span className="font-semibold text-slate-600 text-sm">₹{Number(manualAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                  </div>

                                  {/* 9. Customer Convenience Fees */}
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-700 font-extrabold uppercase tracking-wider">Customer Convenience Fees</span>
                                    <span className="font-semibold text-indigo-600">₹{ccf1Fee.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                  </div>

                                  {/* 10. Total Amount */}
                                  <div className="flex justify-between items-center text-xs bg-indigo-50/50 p-3 rounded-xl border border-indigo-100/50">
                                    <span className="text-indigo-900 font-black uppercase tracking-wider">Total Amount</span>
                                    <span className="text-base font-black text-emerald-600">
                                      ₹{(Number(manualAmount || 0) + ccf1Fee).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </span>
                                  </div>

                                  {/* 11. Payment Mode */}
                                  <div className="space-y-1.5 border-t border-slate-100 pt-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Payment Mode</label>
                                    <select
                                      value={selectedPaymentMode}
                                      onChange={(e) => setSelectedPaymentMode(e.target.value)}
                                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none text-xs font-semibold text-slate-700 focus:border-indigo-500 cursor-pointer"
                                    >
                                      <option value="UPI">UPI</option>
                                      <option value="Wallet">Wallet Balance</option>
                                      <option value="Net Banking">Net Banking</option>
                                      <option value="Debit Card">Debit Card</option>
                                      <option value="Credit Card">Credit Card</option>
                                    </select>
                                  </div>
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
                                      onWheel={(e) => e.currentTarget.blur()}
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
                              )
                            ) : (
                              // Mobile Prepaid Simple Summary
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Recharge Amount (₹)</label>
                                  <input
                                    type="number"
                                    required
                                    value={manualAmount}
                                    onChange={(e) => setManualAmount(e.target.value)}
                                    onWheel={(e) => e.currentTarget.blur()}
                                    placeholder="Enter amount to recharge"
                                    disabled={selectedPlan !== null}
                                    className="w-full bg-white border border-slate-200 focus:border-indigo-500 outline-none rounded-xl px-4 py-3 text-sm font-bold text-slate-800 transition-colors"
                                  />
                                </div>

                                {manualAmount && !isNaN(Number(manualAmount)) && Number(manualAmount) > 0 && (
                                  <div className="bg-indigo-50/50 border border-indigo-100/50 rounded-2xl p-4 space-y-2">
                                    <div className="flex justify-between items-center text-xs text-slate-500 font-medium">
                                      <span>Base Amount</span>
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
                                disabled={loading || (!billDetails?.fetchSupported && !manualAmount && selectedCategory !== 'Mobile Prepaid')}
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
                </div>
              )}

              {/* Step 3: Success Receipt */}
              {step === 3 && receipt && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start justify-center max-w-6xl mx-auto py-8">
                  {/* Left Column: Receipt Card */}
                  <div className="lg:col-span-7 flex flex-col items-center justify-center w-full">
                    <div className="w-full max-w-md bg-white border border-slate-200 rounded-[32px] p-6 shadow-xl space-y-6 relative" id="receipt-print-area">
                      <div className="absolute top-4 right-4 z-10">
                        <img id="pdf-assured-logo" src="/assured_logo.png" alt="Be-Assured Logo" style={{ width: '80px', height: '80px', objectFit: 'contain' }} className="opacity-100 brightness-110 filter drop-shadow-sm" />
                      </div>

                      <div className="text-center border-b border-dashed border-slate-100 pb-5">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <CheckCircle2 className="text-emerald-500" size={40} />
                          <span className="text-[10px] bg-slate-900 text-white px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider">Receipt</span>
                        </div>
                        <div className="text-2xl font-black text-slate-800 mt-4">
                          ₹{receipt.totalAmount.toFixed(2)}
                        </div>
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1">Transaction Success</p>
                      </div>

                      <div className="space-y-3.5 text-xs font-semibold text-slate-600">
                        <div className="flex justify-between border-b border-slate-100 pb-2">
                          <span className="text-slate-400 uppercase tracking-wider text-[9px]">B-Connect Transaction ID</span>
                          <span className="font-black text-slate-800 text-right select-all font-mono">{receipt.bConnectTxnId}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-2">
                          <span className="text-slate-400 uppercase tracking-wider text-[9px]">Biller ID</span>
                          <span className="font-black text-slate-800 text-right">{receipt.billerId}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-2">
                          <span className="text-slate-400 uppercase tracking-wider text-[9px]">Biller Name</span>
                          <span className="font-black text-slate-800 text-right">{receipt.billerName}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-2">
                          <span className="text-slate-400 uppercase tracking-wider text-[9px]">Customer Name</span>
                          <span className="font-black text-slate-800 text-right">{receipt.customerName}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-2">
                          <span className="text-slate-400 uppercase tracking-wider text-[9px]">Customer Number</span>
                          <span className="font-black text-slate-800 text-right">{receipt.customerNumber}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-2">
                          <span className="text-slate-400 uppercase tracking-wider text-[9px]">Bill Date</span>
                          <span className="font-black text-slate-800 text-right">{receipt.billDate}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-2">
                          <span className="text-slate-400 uppercase tracking-wider text-[9px]">Bill Period</span>
                          <span className="font-black text-slate-800 text-right">{receipt.billPeriod}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-2">
                          <span className="text-slate-400 uppercase tracking-wider text-[9px]">Bill Number</span>
                          <span className="font-black text-slate-800 text-right">{receipt.billNumber}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-2">
                          <span className="text-slate-400 uppercase tracking-wider text-[9px]">Due Date</span>
                          <span className="font-black text-slate-800 text-right text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">{receipt.dueDate}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-2">
                          <span className="text-slate-400 uppercase tracking-wider text-[9px]">Bill Amount</span>
                          <span className="font-black text-slate-800 text-right">₹{receipt.billAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-2">
                          <span className="text-slate-400 uppercase tracking-wider text-[9px]">Customer Convenience Fees</span>
                          <span className="font-black text-slate-800 text-right">₹{receipt.ccf1Fee.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-2">
                          <span className="text-slate-400 uppercase tracking-wider text-[9px]">Total Amount</span>
                          <span className="font-black text-emerald-600 text-right text-sm">₹{receipt.totalAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-2">
                          <span className="text-slate-400 uppercase tracking-wider text-[9px]">Transaction Date and Time</span>
                          <span className="font-black text-slate-800 text-right">{receipt.date}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-2">
                          <span className="text-slate-400 uppercase tracking-wider text-[9px]">Initiating Channel</span>
                          <span className="font-black text-slate-800 text-right">{receipt.initiatingChannel}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-2">
                          <span className="text-slate-400 uppercase tracking-wider text-[9px]">Payment Mode</span>
                          <span className="font-black text-slate-800 text-right">{receipt.paymentMode}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-2">
                          <span className="text-slate-400 uppercase tracking-wider text-[9px]">Transaction Status</span>
                          <span className="font-black text-emerald-600 text-right">{receipt.transactionStatus}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400 uppercase tracking-wider text-[9px]">Approval Number</span>
                          <span className="font-black text-slate-800 text-right">{receipt.approvalNumber}</span>
                        </div>
                      </div>

                      <div className="border-t border-slate-100 pt-5 flex items-center justify-between text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none">
                        <div className="flex items-center gap-1">
                          <ShieldCheck size={11} className="text-emerald-500" />
                          Bharat Connect Secured
                        </div>
                        <span>UAT STAGING</span>
                      </div>
                    </div>

                    <div className="mt-8 flex gap-4 w-full max-w-md print:hidden">
                      <button
                        onClick={downloadPDFReceipt}
                        className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer border border-slate-200/50"
                      >
                        <Printer size={14} />
                        Download PDF
                      </button>
                      <button
                        onClick={resetForm}
                        className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-100"
                      >
                        Done
                      </button>
                    </div>
                  </div>

                  {/* Right Column: Simulated Mobile Mockup */}
                  <div className="lg:col-span-5 flex flex-col items-center justify-center print:hidden w-full">
                    {/* Simulated Mobile Phone Frame */}
                    <div className="relative mx-auto bg-slate-900 border-[12px] border-slate-950 rounded-[40px] h-[550px] w-[270px] shadow-2xl overflow-hidden select-none">
                      {/* Notch/Speaker */}
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-950 rounded-b-2xl z-40 flex items-center justify-center gap-1.5">
                        <div className="w-12 h-1 bg-neutral-800 rounded-full"></div>
                        <div className="w-2.5 h-2.5 bg-neutral-900 border border-neutral-800 rounded-full"></div>
                      </div>

                      {/* Screen Content */}
                      <div className="w-full h-full bg-[#121212] relative text-white flex flex-col font-sans pt-6">
                        {/* Status Bar */}
                        <div className="px-5 py-1.5 flex justify-between items-center text-[10px] font-bold text-neutral-400 z-30 select-none">
                          <span>{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                          <div className="flex items-center gap-1">
                            <span className="w-3.5 h-2 bg-neutral-400 rounded-sm"></span>
                          </div>
                        </div>

                        <AnimatePresence mode="wait">
                          {!isSmsAppOpen ? (
                            /* Lock Screen / Home Screen with Slide-in Notification */
                            <motion.div
                              key="lockscreen"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="absolute inset-0 bg-gradient-to-b from-indigo-950 via-slate-900 to-emerald-950 flex flex-col justify-between p-5 pt-10"
                            >
                              {/* Date and Time on Lock Screen */}
                              <div className="text-center space-y-1 mt-6">
                                <span className="text-4xl font-extralight">
                                  {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                </span>
                                <p className="text-[10px] text-neutral-300 font-medium uppercase tracking-wider">
                                  {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
                                </p>
                              </div>

                              {/* Notification Banner */}
                              <motion.div
                                initial={{ y: -100, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.8, type: 'spring', stiffness: 100 }}
                                onClick={() => setIsSmsAppOpen(true)}
                                className="bg-[#1f1f1fc0] backdrop-blur-md border border-white/10 rounded-2xl p-3 shadow-lg flex gap-3 cursor-pointer hover:bg-[#2e2e2ed0] transition-colors text-left"
                              >
                                <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-xs shrink-0 shadow-md shadow-indigo-500/20">
                                  <MessageSquare size={14} />
                                </div>
                                <div className="space-y-0.5 text-left overflow-hidden">
                                  <div className="flex justify-between items-center w-full">
                                    <span className="text-[10px] font-black text-neutral-300 uppercase tracking-wider">Messages</span>
                                    <span className="text-[9px] text-neutral-400">now</span>
                                  </div>
                                  <p className="text-[10px] font-bold text-white">UsePay</p>
                                  <p className="text-[9px] text-neutral-300 leading-normal truncate">
                                    Thank you for payment of Rs.{receipt.totalAmount.toFixed(2)} against {selectedCategory}...
                                  </p>
                                </div>
                              </motion.div>

                              {/* Bottom Swipe text */}
                              <div className="text-center pb-4 animate-pulse">
                                <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-widest">Swipe up to unlock</p>
                              </div>
                            </motion.div>
                          ) : (
                            /* SMS Messages App Thread */
                            <motion.div
                              key="smsapp"
                              initial={{ y: 20, opacity: 0 }}
                              animate={{ y: 0, opacity: 1 }}
                              exit={{ y: -20, opacity: 0 }}
                              className="flex-1 flex flex-col h-full bg-[#121212]"
                            >
                              {/* SMS Header */}
                              <div className="bg-[#1e1e1e] border-b border-neutral-800 py-2.5 px-4 flex items-center gap-3 shrink-0 text-left">
                                <button
                                  onClick={() => setIsSmsAppOpen(false)}
                                  className="text-neutral-400 hover:text-white transition-colors"
                                >
                                  <ArrowLeft size={16} />
                                </button>
                                <div className="w-8 h-8 bg-neutral-700 rounded-full flex items-center justify-center font-bold text-sm text-indigo-400 border border-neutral-600">
                                  UP
                                </div>
                                <div className="text-left">
                                  <p className="text-xs font-black text-white">UsePay</p>
                                  <p className="text-[8px] text-emerald-500 font-bold uppercase tracking-wider">Online</p>
                                </div>
                              </div>

                              {/* Chat Area */}
                              <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col justify-end">
                                <div className="text-center">
                                  <span className="text-[9px] bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded-full font-bold">
                                    Today {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                  </span>
                                </div>

                                {/* SMS Bubble 1: Payment */}
                                <motion.div
                                  initial={{ scale: 0.9, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  transition={{ delay: 0.2 }}
                                  className="bg-[#242424] border border-neutral-800 text-neutral-200 rounded-2xl rounded-tl-none p-3.5 text-[10px] leading-relaxed max-w-[85%] self-start space-y-1 shadow-md"
                                >
                                  <p className="text-left font-medium">
                                    Thank you for payment of Rs.{receipt.totalAmount.toFixed(2)} against {selectedCategory}, Consumer no{' '}
                                    <span className="underline font-bold text-white select-all">
                                      {Object.values(receipt.consumerDetails)[0] || receipt.customerNumber}
                                    </span>
                                    , B-Connect Txn id{' '}
                                    <span className="underline font-bold text-white select-all">
                                      {receipt.bConnectTxnId}
                                    </span>{' '}
                                    on{' '}
                                    <span className="underline">
                                      {getFormattedDateForSms()}
                                    </span>{' '}
                                    vide Cash.
                                  </p>
                                </motion.div>

                                {/* SMS Bubble 2: Complaint */}
                                <motion.div
                                  initial={{ scale: 0.9, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  transition={{ delay: 0.8 }}
                                  className="bg-[#242424] border border-neutral-800 text-neutral-200 rounded-2xl rounded-tl-none p-3.5 text-[10px] leading-relaxed max-w-[85%] self-start space-y-1 shadow-md"
                                >
                                  <p className="text-left font-medium">
                                    Your Complaint has been registered successfully for B-Connect Txn id{' '}
                                    <span className="underline font-bold text-white select-all">
                                      {receipt.bConnectTxnId}
                                    </span>
                                    . Your Complaint ID is{' '}
                                    <span className="underline font-bold text-white select-all">
                                      {'CC01' + Math.floor(1000000000 + Math.random() * 9000000000).toString()}
                                    </span>
                                    . You can track status of your complaint using your Complaint ID.
                                  </p>
                                </motion.div>
                              </div>

                              {/* SMS Input Mock */}
                              <div className="p-3 bg-[#1e1e1e] border-t border-neutral-800 flex gap-2 items-center shrink-0">
                                <input
                                  type="text"
                                  disabled
                                  placeholder="Text Message"
                                  className="flex-1 bg-[#282828] border border-neutral-700 rounded-full px-4 py-1.5 text-[10px] outline-none text-neutral-400"
                                />
                                <div className="w-7 h-7 bg-neutral-700 rounded-full flex items-center justify-center text-neutral-400">
                                  <ArrowRight size={14} />
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
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
