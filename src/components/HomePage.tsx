import React from 'react';
import {
  Smartphone,
  Tablet,
  Landmark,
  Receipt,
  ShieldCheck,
  Ticket,
  CreditCard,
  QrCode,
  ArrowRight,
  Menu,
  X,
  MapPin,
  Phone,
  Mail,
  Zap,
  Globe,
  Lock,
  ChevronRight,
  Clock,
  Code2,
  Terminal,
  CheckCircle2,
  Send,
  Copy,
  Check,
  Cpu,
  Layers,
  Sparkles,
  ArrowUpRight,
  Star,
  Award,
  TrendingUp,
  Headphones,
  ChevronDown,
  ChevronUp,
  Shield,
  Activity,
  Building2,
  Wallet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';

interface HomePageProps {
  isAdmin: boolean;
  isUser: boolean;
  onLogout: () => void;
}

export default function HomePage({ isAdmin, isUser }: HomePageProps) {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [activeApiTab, setActiveApiTab] = React.useState<'payout' | 'bbps' | 'dmt'>('payout');
  const [codeViewMode, setCodeViewMode] = React.useState<'request' | 'response'>('request');
  const [copiedCode, setCopiedCode] = React.useState(false);
  const [serviceFilter, setServiceFilter] = React.useState<'all' | 'retail' | 'banking'>('all');
  const [openFaqIndex, setOpenFaqIndex] = React.useState<number | null>(0);
  const [contactSubject, setContactSubject] = React.useState('General Merchant Inquiry');
  const [contactMessage, setContactMessage] = React.useState('');
  const [contactName, setContactName] = React.useState('');
  const [contactEmail, setContactEmail] = React.useState('');
  const [contactSubmitted, setContactSubmitted] = React.useState(false);

  const navigate = useNavigate();
  const isLoggedIn = isAdmin || isUser;

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setIsMenuOpen(false);
  };

  const handleRequestService = (serviceName: string) => {
    setContactSubject(`Service Onboarding: ${serviceName}`);
    setContactMessage(`Hello UsePay Team, I want to activate ${serviceName} for my business/shop. Please contact me with the retailer onboarding details and commission rates.`);
    scrollToSection('contact');
  };

  const handleRequestApi = (apiName: string) => {
    setContactSubject(`B2B API Integration: ${apiName}`);
    setContactMessage(`Hello UsePay Team, I would like to integrate your ${apiName} into our system. Please share the API Documentation, pricing, and sandbox credentials.`);
    scrollToSection('contact');
  };

  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setContactSubmitted(true);
    setTimeout(() => setContactSubmitted(false), 5000);
  };

  const services = [
    {
      title: 'BBPS Utility Bill Payment',
      category: 'banking',
      desc: 'Seamless bill payments for Electricity, Water, Gas, FASTag, Landline and Broadband across India.',
      icon: Receipt,
      badge: '20,000+ Billers',
      commission: 'High Instant Commission',
      color: 'from-emerald-500/10 to-teal-500/10 text-emerald-600 border-emerald-100'
    },
    {
      title: 'Instant Bank Payouts',
      category: 'banking',
      desc: '24x7 IMPS, NEFT and UPI disbursements with sub-second settlements directly into any bank account.',
      icon: Send,
      badge: '< 300ms Speed',
      commission: 'Flat Bulk Rates',
      color: 'from-indigo-500/10 to-blue-500/10 text-indigo-600 border-indigo-100'
    },
    {
      title: 'Domestic Money Transfer (DMT)',
      category: 'banking',
      desc: 'Cash-to-bank remittance with instant OTP-verified remitter registration and high monthly limits.',
      icon: Landmark,
      badge: 'High Success Ratio',
      commission: 'Instant Commission',
      color: 'from-purple-500/10 to-pink-500/10 text-purple-600 border-purple-100'
    },
    {
      title: 'Aadhaar ATM (AEPS)',
      category: 'retail',
      desc: 'Biometric cash withdrawals, mini statements, and balance checks for all major Indian banks.',
      icon: ShieldCheck,
      badge: 'Biometric Auth',
      commission: 'Up to ₹13 / txn',
      color: 'from-amber-500/10 to-orange-500/10 text-amber-600 border-amber-100'
    },
    {
      title: 'Mobile & DTH Recharge',
      category: 'retail',
      desc: 'Instant prepaid & postpaid recharges for Jio, Airtel, Vi, BSNL, Tata Play, Sun Direct & more.',
      icon: Smartphone,
      badge: 'Auto Roaming Plan',
      commission: 'Best Telco Margins',
      color: 'from-sky-500/10 to-cyan-500/10 text-sky-600 border-sky-100'
    },
    {
      title: 'POS & Soundbox Machines',
      category: 'retail',
      desc: 'Accept QR code and card payments with instant audio voice announcements and automated daily settlements.',
      icon: QrCode,
      badge: 'Voice Confirmation',
      commission: 'Low MDR Rates',
      color: 'from-slate-500/10 to-zinc-500/10 text-slate-700 border-slate-200'
    },
    {
      title: 'Digital Bank Account Opening',
      category: 'banking',
      desc: 'Instant zero-balance savings & current accounts with paperless Video-KYC and instant debit cards.',
      icon: Building2,
      badge: 'Zero Paperwork',
      commission: 'Earn per Account',
      color: 'from-rose-500/10 to-red-500/10 text-rose-600 border-rose-100'
    },
    {
      title: 'Pan Card & Travel Booking',
      category: 'retail',
      desc: 'Apply new & update PAN cards via UTI/NSDL. Book Bus, Train, and Flight tickets at unbeatable fares.',
      icon: Ticket,
      badge: 'Instant Acknowledgment',
      commission: 'Extra Income',
      color: 'from-violet-500/10 to-purple-500/10 text-violet-600 border-violet-100'
    },
  ];

  const filteredServices = serviceFilter === 'all'
    ? services
    : services.filter(s => s.category === serviceFilter);

  const apiSnippets = {
    payout: {
      title: 'Instant Payout API',
      subtitle: '24x7 IMPS / NEFT / RTGS & UPI',
      endpoint: 'POST https://sandbox.usepay.in/v1/payout/transfer',
      request: `// POST https://sandbox.usepay.in/v1/payout/transfer
// Headers: Authorization: Bearer sandbox_key_demo...
{
  "reference_id": "USEPAY_TXN_984129",
  "account_number": "987654321012",
  "ifsc": "HDFC0001234",
  "beneficiary_name": "Rajesh Patel",
  "amount": 5000.00,
  "mode": "IMPS"
}`,
      response: `// Sandbox Demo Response (Simulated 280ms)
{
  "status": "SUCCESS",
  "code": 200,
  "utr": "426819284192",
  "bank_ref": "HDFC_IMPS_9812",
  "settlement": "INSTANT",
  "mode": "SANDBOX_SIMULATION",
  "message": "Funds credited successfully"
}`
    },
    bbps: {
      title: 'BBPS Bill Payment API',
      subtitle: '20,000+ Bharat BillPay Live Billers',
      endpoint: 'POST https://sandbox.usepay.in/v1/bill-payment/pay',
      request: `// POST https://sandbox.usepay.in/v1/bill-payment/pay
// Headers: Authorization: Bearer sandbox_key_demo...
{
  "client_ref_id": "BILL_902184",
  "biller_id": "UGVCL0000GUJ01",
  "consumer_number": "1002948291",
  "bill_amount": 1420.00,
  "payment_mode": "WALLET"
}`,
      response: `// Sandbox Demo Response
{
  "status": "SUCCESS",
  "code": 200,
  "txn_id": "BBPS928174129",
  "biller_ack_no": "ACK_881928",
  "convenience_fee": 0.00,
  "commission_earned": 3.50
}`
    },
    dmt: {
      title: 'DMT (Money Transfer) API',
      subtitle: 'Instant Cash-to-Bank Remittance',
      endpoint: 'POST https://sandbox.usepay.in/v1/dmt/transfer',
      request: `// POST https://sandbox.usepay.in/v1/dmt/transfer
// Headers: Authorization: Bearer sandbox_key_demo...
{
  "client_txnid": "DMT_662819",
  "remitter_phone": "9898012345",
  "beneficiary_id": "BEN_88291",
  "amount": 25000.00,
  "channel": "IMPS"
}`,
      response: `// Sandbox Demo Response
{
  "status": "SUCCESS",
  "code": 200,
  "rrn": "626810294819",
  "beneficiary_name": "RAMESHBHAI PATEL",
  "transferred_amount": 25000.00,
  "service_charge": 10.00
}`
    }
  };

  const testimonials = [
    {
      name: 'Rajesh Patel',
      role: 'Retail Store Owner, Surat',
      text: 'UsePay has completely transformed my daily business. AEPS withdrawals and Bill Payments process in under 2 seconds. The commission is credited instantly to my wallet without delay!',
      rating: 5,
      city: 'Surat, Gujarat'
    },
    {
      name: 'Suresh Prajapati',
      role: 'Master Distributor, Ahmedabad',
      text: 'Managing 250+ retailers was challenging before UsePay. Now, real-time fund requests, automatic commission splitting, and WhatsApp transaction alerts make it super easy.',
      rating: 5,
      city: 'Ahmedabad, Gujarat'
    },
    {
      name: 'Vikram Singh',
      role: 'Fintech Startup CTO, Mumbai',
      text: 'We integrated the UsePay Payout and BBPS API into our customer portal. The sandbox environment, clear JSON webhooks, and sub-300ms speed are truly world-class.',
      rating: 5,
      city: 'Mumbai, Maharashtra'
    }
  ];

  const faqs = [
    {
      q: 'How fast can a retailer or agent start working with UsePay?',
      a: 'Onboarding is 100% digital and takes under 5 minutes. Submit your basic KYC documents (Aadhaar & PAN) through our web portal, and your ID is activated instantly with full service access.'
    },
    {
      q: 'How and when is commission credited?',
      a: 'All commissions (Recharge, BBPS, AEPS, DMT, PAN) are credited in real-time, instantly as soon as the transaction succeeds. There is no waiting for day-end or monthly reconciliations.'
    },
    {
      q: 'Are UsePay APIs suitable for high-volume enterprise businesses?',
      a: 'Yes! Our API infrastructure handles millions of requests every day with 99.99% uptime, dual bank gateway redundancy, automatic retries, and comprehensive webhook status notifications.'
    },
    {
      q: 'Can I withdraw my wallet earnings to my personal bank account anytime?',
      a: 'Absolutely. UsePay provides 24x7x365 instant wallet-to-bank settlement via IMPS. You can transfer funds at midnight, on Sundays, or bank holidays without any delay.'
    },
    {
      q: 'What kind of support does UsePay provide to retailers and partners?',
      a: 'We provide dedicated relationship manager support along with a 24x7 active WhatsApp helpdesk and call center support located in Surat, Gujarat.'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 overflow-x-hidden selection:bg-indigo-500 selection:text-white">
      {/* --- TOP FLOATING ANNOUNCEMENT BAR --- */}
      <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 text-white text-xs py-2.5 px-4 border-b border-indigo-500/20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-semibold text-slate-200">
              <span className="text-emerald-400 font-bold">Live Status:</span> 99.99% Payment Rails Operational
            </span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-slate-300">
            <span className="flex items-center gap-1.5 hover:text-white transition-colors">
              <ShieldCheck size={14} className="text-indigo-400" /> ISO 27001 Certified Security
            </span>
            <span className="flex items-center gap-1.5 hover:text-white transition-colors">
              <Phone size={13} className="text-emerald-400" /> +91 9512180909
            </span>
            <span className="flex items-center gap-1.5 text-indigo-300 font-bold">
              <Sparkles size={13} /> Instant T+0 Settlements
            </span>
          </div>
        </div>
      </div>

      {/* --- FLOATING HEADER / NAVBAR --- */}
      <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-2xl border-b border-slate-200/80 shadow-sm shadow-slate-900/5 transition-all">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          {/* Brand Logo */}
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <div className="relative">
              <img src="/logo.png" alt="UsePay" className="h-10 w-auto group-hover:scale-105 transition-transform" />
            </div>
            <div className="hidden sm:block border-l border-slate-200 pl-3">
              <p className="text-[10px] font-black tracking-widest uppercase text-slate-400">Fintech Platform</p>
              <p className="text-xs font-black text-indigo-700 -mt-0.5">UsePay Solution</p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-8">
            <button
              onClick={() => scrollToSection('home')}
              className="text-sm font-bold text-slate-600 hover:text-indigo-600 transition-colors"
            >
              Home
            </button>
            <button
              onClick={() => scrollToSection('services')}
              className="text-sm font-bold text-slate-600 hover:text-indigo-600 transition-colors"
            >
              Services
            </button>
            <button
              onClick={() => scrollToSection('api-solutions')}
              className="text-sm font-bold text-slate-700 hover:text-indigo-600 transition-colors flex items-center gap-2 group"
            >
              <span>Developer APIs</span>
              <span className="bg-gradient-to-r from-indigo-600 to-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm group-hover:scale-105 transition-transform">
                B2B
              </span>
            </button>
            <button
              onClick={() => scrollToSection('why-usepay')}
              className="text-sm font-bold text-slate-600 hover:text-indigo-600 transition-colors"
            >
              Why UsePay
            </button>
            <button
              onClick={() => scrollToSection('testimonials')}
              className="text-sm font-bold text-slate-600 hover:text-indigo-600 transition-colors"
            >
              Reviews
            </button>
            <button
              onClick={() => scrollToSection('faq')}
              className="text-sm font-bold text-slate-600 hover:text-indigo-600 transition-colors"
            >
              FAQs
            </button>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => scrollToSection('contact')}
              className="hidden sm:flex text-xs font-black text-slate-700 hover:text-indigo-600 px-4 py-2 rounded-xl transition-colors"
            >
              Contact Us
            </button>

            {isLoggedIn ? (
              <button
                onClick={() => navigate(isAdmin ? '/dashboard' : '/user/dashboard')}
                className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-500/25 flex items-center gap-2 active:scale-95"
              >
                Dashboard <ArrowRight size={16} />
              </button>
            ) : (
              <Link
                to="/login"
                className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white px-7 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-500/25 active:scale-95 flex items-center gap-2"
              >
                <span>Merchant Login</span>
                <ChevronRight size={16} />
              </Link>
            )}

            {/* Mobile Toggle */}
            <button
              className="lg:hidden p-2 text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle Navigation"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </header>

      {/* --- MOBILE NAVIGATION DRAWER --- */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-white/95 backdrop-blur-2xl pt-24 px-6 lg:hidden overflow-y-auto"
          >
            <div className="flex flex-col gap-5 py-6">
              <button
                onClick={() => scrollToSection('home')}
                className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-3 text-left"
              >
                Home
              </button>
              <button
                onClick={() => scrollToSection('services')}
                className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-3 text-left"
              >
                Our Services
              </button>
              <button
                onClick={() => scrollToSection('api-solutions')}
                className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-3 text-left flex items-center justify-between"
              >
                <span>Developer & B2B APIs</span>
                <span className="bg-indigo-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">B2B</span>
              </button>
              <button
                onClick={() => scrollToSection('why-usepay')}
                className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-3 text-left"
              >
                Why Choose UsePay
              </button>
              <button
                onClick={() => scrollToSection('testimonials')}
                className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-3 text-left"
              >
                Retailer Stories
              </button>
              <button
                onClick={() => scrollToSection('faq')}
                className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-3 text-left"
              >
                Frequently Asked Questions
              </button>
              <button
                onClick={() => scrollToSection('contact')}
                className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-3 text-left"
              >
                Contact & Support
              </button>

              <div className="pt-4">
                <Link
                  to="/login"
                  className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-center flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/30"
                >
                  Merchant Login Portal <ArrowRight size={18} />
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- HERO SECTION --- */}
      <section id="home" className="relative pt-12 pb-24 md:pt-20 md:pb-32 px-6 overflow-hidden">
        {/* Modern Vibrant Radial Background Glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-tr from-indigo-500/15 via-emerald-500/10 to-teal-400/10 rounded-full blur-[140px] -z-10 pointer-events-none"></div>
        <div className="absolute top-1/3 -right-60 w-96 h-96 bg-purple-500/15 rounded-full blur-[120px] -z-10 pointer-events-none"></div>

        <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-16 items-center">
          {/* Left Column: Hero Content */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-7 space-y-8"
          >
            {/* Trust Pill */}
            <div className="inline-flex items-center gap-2.5 bg-white border border-indigo-100 text-indigo-700 px-4 py-2 rounded-full text-xs font-black shadow-md shadow-indigo-100/50">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
              <Zap size={14} className="text-amber-500 fill-amber-500" />
              <span>Next-Gen Fintech Operating Platform</span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">NPCI & BBPS Enabled</span>
            </div>

            {/* Giant Title */}
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-black text-slate-900 leading-[1.08] tracking-tight">
              The Powerhouse For <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-indigo-700 to-emerald-500">
                Digital Payments,
              </span>
              <br />
              Payouts & BBPS
            </h1>

            {/* Subtitle */}
            <p className="text-lg md:text-xl text-slate-600 font-medium max-w-xl leading-relaxed">
              Empowering <strong className="text-slate-900 font-bold">50,000+ merchants, distributors & developers</strong> across India with ultra-fast bank payouts, utility bill payments, cash withdrawals, and DMT transfers with 99.99% uptime.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                to="/login"
                className="bg-slate-900 hover:bg-slate-800 text-white px-9 py-5 rounded-2xl font-black text-sm transition-all flex items-center gap-3 shadow-2xl shadow-slate-900/30 active:scale-95 group"
              >
                <span>Get Started Now</span>
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <button
                onClick={() => scrollToSection('api-solutions')}
                className="bg-white border-2 border-slate-200 hover:border-indigo-600 text-slate-800 hover:text-indigo-600 px-8 py-5 rounded-2xl font-black text-sm transition-all shadow-sm hover:shadow-md flex items-center gap-2"
              >
                <Code2 size={18} className="text-indigo-600" />
                <span>Explore B2B APIs</span>
              </button>
            </div>

            {/* Live Trust Metrics */}
            <div className="grid grid-cols-3 gap-6 pt-8 border-t border-slate-200/80">
              <div>
                <h3 className="text-3xl md:text-4xl font-black text-slate-900">50k+</h3>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Active Merchants</p>
              </div>
              <div>
                <h3 className="text-3xl md:text-4xl font-black text-emerald-600">&lt; 300ms</h3>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Instant Settlement</p>
              </div>
              <div>
                <h3 className="text-3xl md:text-4xl font-black text-indigo-600">99.98%</h3>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Success Ratio</p>
              </div>
            </div>
          </motion.div>

          {/* Right Column: Hero Visual - Live Interactive Fintech Terminal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7 }}
            className="lg:col-span-5 relative"
          >
            {/* Background Glow Ring */}
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/25 via-emerald-500/20 to-teal-400/20 rounded-[3.5rem] blur-3xl -z-10 animate-pulse"></div>

            {/* Main Interactive Card */}
            <div className="bg-slate-900 text-white rounded-[3rem] p-7 md:p-8 shadow-2xl border border-slate-800 relative overflow-hidden">
              {/* Card Top Pill */}
              <div className="flex items-center justify-between pb-6 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-emerald-500 flex items-center justify-center font-black text-white shadow-md">
                    UP
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Merchant Wallet</p>
                    <p className="text-sm font-black text-white">UsePay Business Prime</p>
                  </div>
                </div>
                <span className="flex items-center gap-1.5 text-[11px] font-black text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Active Node
                </span>
              </div>

              {/* Balance Widget */}
              <div className="my-6 p-5 rounded-2xl bg-gradient-to-br from-slate-800/80 to-slate-900/90 border border-slate-700/60">
                <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
                  <span>Available Balance</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <TrendingUp size={14} /> +32.4% this week
                  </span>
                </div>
                <div className="text-3xl md:text-4xl font-black text-white tracking-tight">
                  ₹ 2,84,650<span className="text-slate-400 text-2xl font-bold">.40</span>
                </div>
                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-700/40 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <CheckCircle2 size={14} className="text-emerald-400" /> Auto T+0 Payout
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <ShieldCheck size={14} className="text-indigo-400" /> Bank Protected
                  </div>
                </div>
              </div>

              {/* Real-time Live Transaction Ticker */}
              <div className="space-y-3">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Real-time Transactions Stream
                </p>

                {/* Txn 1 */}
                <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-800 flex items-center justify-between hover:bg-slate-800 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                      <Send size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Instant IMPS Payout</p>
                      <p className="text-[10px] text-slate-400">HDFC Bank • UTR: 4291848192</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-emerald-400">₹ 25,000.00</p>
                    <p className="text-[10px] text-emerald-500/80 font-semibold">240ms • SUCCESS</p>
                  </div>
                </div>

                {/* Txn 2 */}
                <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-800 flex items-center justify-between hover:bg-slate-800 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <Receipt size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Torrent Power Electricity</p>
                      <p className="text-[10px] text-slate-400">BBPS Ack: ACK_908412</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-white">₹ 2,420.00</p>
                    <p className="text-[10px] text-indigo-400 font-semibold">Earned ₹ 4.50</p>
                  </div>
                </div>

                {/* Txn 3 */}
                <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-800 flex items-center justify-between hover:bg-slate-800 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                      <ShieldCheck size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">AEPS Cash Withdrawal</p>
                      <p className="text-[10px] text-slate-400">State Bank of India • Fingerprint</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-emerald-400">₹ 10,000.00</p>
                    <p className="text-[10px] text-indigo-400 font-semibold">Earned ₹ 13.00</p>
                  </div>
                </div>
              </div>

              {/* Bottom Quick Badge */}
              <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Activity size={14} className="text-emerald-400" /> Latency: 280ms
                </span>
                <span className="text-slate-500">API Version: 2.4.0 Live</span>
              </div>
            </div>

            {/* Floating Trust Badges */}
            <div className="absolute -bottom-6 -left-6 bg-white p-4 rounded-2xl shadow-2xl border border-slate-100 hidden sm:flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                <ShieldCheck size={24} />
              </div>
              <div>
                <p className="text-xs font-black text-slate-900">100% Encrypted</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase">NPCI / BBPS Approved</p>
              </div>
            </div>

            <div className="absolute -top-6 -right-6 bg-white p-4 rounded-2xl shadow-2xl border border-slate-100 hidden sm:flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                <Zap size={24} />
              </div>
              <div>
                <p className="text-xs font-black text-slate-900">Instant T+0 Wallet</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase">24x7 Direct Bank Credit</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>


      {/* --- CORE RETAIL & BUSINESS SERVICES (BENTO GRID) --- */}
      <section id="services" className="py-24 md:py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-600 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest mb-4">
              Comprehensive Financial Suite
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">
              Everything Your Shop or Business Needs to Succeed
            </h2>
            <p className="text-slate-600 font-medium text-lg mt-4 leading-relaxed">
              Equip your retail point or enterprise portal with market-leading services, maximum commissions, and zero downtime.
            </p>

            {/* Filter Pills */}
            <div className="flex items-center justify-center gap-3 mt-8">
              <button
                onClick={() => setServiceFilter('all')}
                className={`px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all ${
                  serviceFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                All Services (8)
              </button>
              <button
                onClick={() => setServiceFilter('banking')}
                className={`px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all ${
                  serviceFilter === 'banking'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Banking & Payouts
              </button>
              <button
                onClick={() => setServiceFilter('retail')}
                className={`px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all ${
                  serviceFilter === 'retail'
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Retail & Cash Services
              </button>
            </div>
          </div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {filteredServices.map((service, idx) => {
              const Icon = service.icon;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white rounded-[2.5rem] p-8 border border-slate-200/80 shadow-sm hover:shadow-2xl hover:border-indigo-300 transition-all group flex flex-col justify-between"
                >
                  <div>
                    {/* Top Row: Icon + Badge */}
                    <div className="flex items-center justify-between mb-6">
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${service.color} flex items-center justify-center border group-hover:scale-110 transition-transform shadow-sm`}>
                        <Icon size={26} />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                        {service.badge}
                      </span>
                    </div>

                    <h3 className="text-xl font-black text-slate-900 mb-2.5 group-hover:text-indigo-600 transition-colors">
                      {service.title}
                    </h3>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6">
                      {service.desc}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Earning</p>
                      <p className="text-xs font-black text-emerald-600">{service.commission}</p>
                    </div>
                    <button
                      onClick={() => handleRequestService(service.title)}
                      className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 flex items-center justify-center transition-all group-hover:scale-105"
                      title="Activate this service"
                    >
                      <ArrowUpRight size={16} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* --- B2B DEVELOPER API SUITE (LUXURY DARK TECH SECTION) --- */}
      <section id="api-solutions" className="py-24 md:py-32 bg-slate-950 text-white relative px-6 overflow-hidden">
        {/* Ambient Neon Lighting */}
        <div className="absolute top-1/4 -left-48 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[140px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 -right-48 w-[500px] h-[500px] bg-emerald-500/20 rounded-full blur-[140px] pointer-events-none"></div>

        <div className="max-w-7xl mx-auto relative z-10">
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto mb-20">
            <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest leading-none mb-6">
              <Code2 size={16} /> B2B Developer APIs & SDKs
            </div>
            <h2 className="text-4xl md:text-6xl font-black text-white leading-tight tracking-tight">
              Enterprise Fintech APIs <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-emerald-400 to-teal-300">
                Engineered For Extreme Scale
              </span>
            </h2>
            <p className="text-slate-400 text-lg font-medium leading-relaxed mt-5">
              Empower your portal, mobile application, or ERP with UsePay's high-speed API infrastructure. Integrate Bill Payment (BBPS), Instant Bank Payouts, and Domestic Money Transfer (DMT) with sub-second latency.
            </p>
          </div>

          {/* 3 Main API Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
            {/* 1. Bill Payment API (BBPS) */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 hover:border-emerald-500/50 rounded-[2.5rem] p-8 transition-all hover:shadow-2xl hover:shadow-emerald-500/10 flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 group-hover:scale-110 transition-transform">
                    <Receipt size={28} />
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    20,000+ Billers
                  </span>
                </div>

                <h3 className="text-2xl font-black text-white mb-2">BBPS Bill Payment API</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  Direct integration with Bharat BillPay for automated bill fetch, validation, and real-time payment execution across India.
                </p>

                <div className="space-y-3 mb-8">
                  {[
                    'Electricity, Water, Gas & Broadband',
                    'Real-time Bill Fetch & Instant Receipt',
                    'Attractive Commission & High Margin',
                    '99.98% Transaction Success Ratio'
                  ].map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2.5 text-xs font-semibold text-slate-300">
                      <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <button
                  onClick={() => handleRequestApi('Bill Payment (BBPS) API')}
                  className="w-full bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 font-black text-xs uppercase tracking-widest py-4 px-6 rounded-2xl border border-emerald-500/30 transition-all flex items-center justify-center gap-2 group-hover:bg-emerald-500 group-hover:text-slate-950 shadow-lg shadow-emerald-500/5"
                >
                  Request BBPS API <ArrowUpRight size={16} />
                </button>
              </div>
            </motion.div>

            {/* 2. Instant Payout API */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 hover:border-indigo-500/50 rounded-[2.5rem] p-8 transition-all hover:shadow-2xl hover:shadow-indigo-500/10 flex flex-col justify-between group relative"
            >
              <div className="absolute -top-3.5 right-8 bg-gradient-to-r from-indigo-500 to-emerald-500 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg">
                Most Popular
              </div>

              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20 group-hover:scale-110 transition-transform">
                    <Send size={28} />
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    &lt; 300ms IMPS
                  </span>
                </div>

                <h3 className="text-2xl font-black text-white mb-2">Instant Payout API</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  Disburse payouts to any bank account in India 24x7x365. Ideal for instant vendor payments, user withdrawals, and salary disbursements.
                </p>

                <div className="space-y-3 mb-8">
                  {[
                    '24x7 IMPS, NEFT, RTGS & UPI Support',
                    'Instant Penny Drop Account Verification',
                    'Single & Bulk Batch Transfers with Webhooks',
                    'Automatic Retry & Smart Banking Routes'
                  ].map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2.5 text-xs font-semibold text-slate-300">
                      <CheckCircle2 size={16} className="text-indigo-400 shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <button
                  onClick={() => handleRequestApi('Instant Payout API')}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-widest py-4 px-6 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/20"
                >
                  Request Payout API <ArrowUpRight size={16} />
                </button>
              </div>
            </motion.div>

            {/* 3. DMT API */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 hover:border-purple-500/50 rounded-[2.5rem] p-8 transition-all hover:shadow-2xl hover:shadow-purple-500/10 flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20 group-hover:scale-110 transition-transform">
                    <Landmark size={28} />
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    High Limits
                  </span>
                </div>

                <h3 className="text-2xl font-black text-white mb-2">DMT (Money Transfer) API</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  Empower retail networks and fintech agents to transfer money securely to any bank account with instant KYC and OTP flows.
                </p>

                <div className="space-y-3 mb-8">
                  {[
                    'Instant Customer Remitter Registration',
                    'Direct Beneficiary Account Verification',
                    'High Monthly Transaction Quotas',
                    'Instant SMS Alert & PDF Receipt Generation'
                  ].map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2.5 text-xs font-semibold text-slate-300">
                      <CheckCircle2 size={16} className="text-purple-400 shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <button
                  onClick={() => handleRequestApi('DMT (Money Transfer) API')}
                  className="w-full bg-purple-500/10 hover:bg-purple-500 text-purple-400 hover:text-white font-black text-xs uppercase tracking-widest py-4 px-6 rounded-2xl border border-purple-500/30 transition-all flex items-center justify-center gap-2 group-hover:bg-purple-600 group-hover:text-white shadow-lg shadow-purple-500/5"
                >
                  Request DMT API <ArrowUpRight size={16} />
                </button>
              </div>
            </motion.div>
          </div>

          {/* Interactive Code Preview & Developer Showcase */}
          <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-6 md:p-12 shadow-2xl">
            <div className="grid lg:grid-cols-12 gap-10 items-center">
              {/* Left Column: Interactive Terminal */}
              <div className="lg:col-span-7 space-y-4">
                {/* API Selector Tabs */}
                <div className="flex flex-wrap items-center gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800/80">
                  <button
                    onClick={() => setActiveApiTab('payout')}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                      activeApiTab === 'payout'
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Send size={14} /> Payout API
                  </button>
                  <button
                    onClick={() => setActiveApiTab('bbps')}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                      activeApiTab === 'bbps'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Receipt size={14} /> BBPS Bill API
                  </button>
                  <button
                    onClick={() => setActiveApiTab('dmt')}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                      activeApiTab === 'dmt'
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Landmark size={14} /> DMT API
                  </button>
                </div>

                {/* Terminal Window */}
                <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden font-mono text-xs shadow-inner">
                  {/* Top Bar */}
                  <div className="bg-slate-900/90 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-rose-500/80"></div>
                      <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                      <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
                      <span className="text-[11px] font-bold text-slate-400 ml-2">
                        {apiSnippets[activeApiTab].endpoint}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Request / Response Switch */}
                      <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-[10px]">
                        <button
                          onClick={() => setCodeViewMode('request')}
                          className={`px-2 py-0.5 rounded font-bold transition-all ${
                            codeViewMode === 'request' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                          }`}
                        >
                          Request
                        </button>
                        <button
                          onClick={() => setCodeViewMode('response')}
                          className={`px-2 py-0.5 rounded font-bold transition-all ${
                            codeViewMode === 'response' ? 'bg-emerald-600 text-white' : 'text-slate-400'
                          }`}
                        >
                          Response
                        </button>
                      </div>

                      <button
                        onClick={() =>
                          handleCopyCode(
                            codeViewMode === 'request'
                              ? apiSnippets[activeApiTab].request
                              : apiSnippets[activeApiTab].response
                          )
                        }
                        className="text-slate-400 hover:text-white p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition-all flex items-center gap-1"
                        title="Copy code"
                      >
                        {copiedCode ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Code Body */}
                  <div className="p-5 overflow-x-auto text-slate-300 leading-relaxed max-h-[300px]">
                    <pre className="text-indigo-300 font-mono text-xs">
                      <code>
                        {codeViewMode === 'request'
                          ? apiSnippets[activeApiTab].request
                          : apiSnippets[activeApiTab].response}
                      </code>
                    </pre>
                  </div>
                </div>
              </div>

              {/* Right Column: Why Integrate */}
              <div className="lg:col-span-5 space-y-6">
                <div>
                  <h4 className="text-2xl font-black text-white leading-tight">
                    Developer-First Integration & Sandbox Access
                  </h4>
                  <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                    Designed for software architects and CTOs who demand bulletproof stability, detailed error diagnostics, and rapid time-to-market.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
                    <p className="text-emerald-400 font-black text-xl">99.99%</p>
                    <p className="text-xs font-bold text-slate-400 uppercase mt-0.5">Uptime SLA</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
                    <p className="text-indigo-400 font-black text-xl">&lt; 300ms</p>
                    <p className="text-xs font-bold text-slate-400 uppercase mt-0.5">API Latency</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
                    <p className="text-purple-400 font-black text-xl">Postman</p>
                    <p className="text-xs font-bold text-slate-400 uppercase mt-0.5">Ready Collection</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
                    <p className="text-amber-400 font-black text-xl">24x7</p>
                    <p className="text-xs font-bold text-slate-400 uppercase mt-0.5">Tech Support</p>
                  </div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => handleRequestApi(`${apiSnippets[activeApiTab].title}`)}
                    className="flex-1 bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white py-4 px-6 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-2"
                  >
                    Get API Credentials <ArrowRight size={16} />
                  </button>
                  <a
                    href="https://wa.me/919512180909?text=Hello%20UsePay%20Team%2C%20I%20am%20interested%20in%20your%20B2B%20APIs%20(Bill%20Payment%2C%20Payout%2C%20DMT)."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-4 px-6 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-slate-700"
                  >
                    WhatsApp Chat
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- WHY CHOOSE USEPAY (COMPETITIVE ADVANTAGE) --- */}
      <section id="why-usepay" className="py-24 md:py-32 px-6 bg-slate-100/60">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-700 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest mb-4">
              The UsePay Advantage
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">
              Why Thousands of Businesses Trust UsePay Everyday
            </h2>
            <p className="text-slate-600 font-medium text-lg mt-4">
              We built our fintech engine with one goal: zero transaction dropouts and maximum earning potential for our partners.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Card 1 */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-6">
                <Zap size={28} />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-3">Instant T+0 Settlements</h3>
              <p className="text-slate-500 text-sm font-medium leading-relaxed">
                No waiting till the evening or next business day. Withdraw your wallet balance directly to your bank account anytime 24x7.
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-6">
                <Award size={28} />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-3">Top Industry Commissions</h3>
              <p className="text-slate-500 text-sm font-medium leading-relaxed">
                Enjoy transparent, market-leading margins credited directly in real-time on every single recharge, bill, and money transfer.
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-6">
                <Layers size={28} />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-3">Smart Auto-Routing</h3>
              <p className="text-slate-500 text-sm font-medium leading-relaxed">
                If any banking partner encounters downtime, our multi-bank engine switches instantly to backup rails, keeping your success rate above 99.9%.
              </p>
            </div>

            {/* Card 4 */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-6">
                <Headphones size={28} />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-3">Dedicated Desk Support</h3>
              <p className="text-slate-500 text-sm font-medium leading-relaxed">
                Direct phone and WhatsApp assistance from our expert team in Surat. No robotic waiting loops—talk to a real fintech specialist immediately.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --- RETAILER SUCCESS STORIES & REVIEWS --- */}
      <section id="testimonials" className="py-24 md:py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-700 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest mb-4">
              Real Partner Experiences
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">
              Loved by Retailers & Developers Across Gujarat & India
            </h2>
            <p className="text-slate-600 font-medium text-lg mt-4">
              Hear directly from merchants who increased their footfall and daily income with UsePay.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((item, idx) => (
              <div
                key={idx}
                className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-1 text-amber-400 mb-6">
                    {[...Array(item.rating)].map((_, i) => (
                      <Star key={i} size={18} className="fill-amber-400" />
                    ))}
                  </div>
                  <p className="text-slate-700 font-medium leading-relaxed mb-8 italic">
                    "{item.text}"
                  </p>
                </div>

                <div className="pt-6 border-t border-slate-100 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-indigo-600 to-emerald-500 text-white font-black flex items-center justify-center shadow-md">
                    {item.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-sm">{item.name}</h4>
                    <p className="text-xs text-slate-500">{item.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- FREQUENTLY ASKED QUESTIONS (ACCORDION) --- */}
      <section id="faq" className="py-24 md:py-32 px-6 bg-slate-100/60">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-700 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest mb-4">
              Got Questions?
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="text-slate-600 font-medium text-lg mt-3">
              Clear answers to help you get started as an agent, distributor, or API partner.
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={idx}
                  className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm transition-all"
                >
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full p-6 md:p-8 text-left font-black text-slate-900 text-lg flex items-center justify-between gap-4 hover:text-indigo-600 transition-colors"
                  >
                    <span>{faq.q}</span>
                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                      {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </button>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="px-6 pb-8 md:px-8 text-slate-600 leading-relaxed font-medium text-base border-t border-slate-50 pt-4"
                      >
                        {faq.a}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* --- CONTACT & GET IN TOUCH SECTION --- */}
      <section id="contact" className="py-24 px-6">
        <div className="max-w-7xl mx-auto bg-gradient-to-br from-indigo-700 via-indigo-600 to-indigo-900 rounded-[3.5rem] p-8 md:p-16 lg:p-20 relative overflow-hidden shadow-2xl shadow-indigo-600/30 text-white">
          {/* Subtle Ambient Orbs */}
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-white/10 rounded-full blur-[100px] pointer-events-none"></div>
          <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-emerald-400/10 rounded-full blur-[100px] pointer-events-none"></div>

          <div className="relative z-10 grid lg:grid-cols-2 gap-16 items-start">
            {/* Info Column */}
            <div className="space-y-10">
              <div className="space-y-4">
                <span className="text-xs font-black uppercase tracking-widest text-indigo-200 bg-white/10 px-3.5 py-1.5 rounded-full border border-white/15">
                  Direct Response Guarantee
                </span>
                <h2 className="text-4xl md:text-5xl font-black text-white leading-tight">
                  Ready to Grow Your Business? Let's Talk!
                </h2>
                <p className="text-indigo-100 text-lg font-medium opacity-90 max-w-md leading-relaxed">
                  Join our retailer and developer network today. Our team in Surat will help you set up and start transacting within 15 minutes.
                </p>
              </div>

              <div className="grid gap-6">
                {/* Address */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white shrink-0 border border-white/15">
                    <MapPin size={22} />
                  </div>
                  <div>
                    <h4 className="text-white font-black text-xs uppercase tracking-widest mb-1 opacity-70">
                      Corporate Office
                    </h4>
                    <p className="text-white font-bold leading-relaxed">
                      413, AR Mall, Opp. Panvel Point, Mota Varachha,<br />
                      Surat, Gujarat 394101
                    </p>
                  </div>
                </div>

                {/* Phone */}
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white shrink-0 border border-white/15">
                    <Phone size={22} />
                  </div>
                  <div>
                    <h4 className="text-white font-black text-xs uppercase tracking-widest mb-1 opacity-70">
                      Direct Phone & WhatsApp
                    </h4>
                    <p className="text-white font-black text-xl">+91 9512180909</p>
                  </div>
                </div>

                {/* Email */}
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white shrink-0 border border-white/15">
                    <Mail size={22} />
                  </div>
                  <div>
                    <h4 className="text-white font-black text-xs uppercase tracking-widest mb-1 opacity-70">
                      Official Email
                    </h4>
                    <p className="text-white font-bold text-base">usepay.in@gmail.com</p>
                  </div>
                </div>

                {/* Hours */}
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white shrink-0 border border-white/15">
                    <Clock size={22} />
                  </div>
                  <div>
                    <h4 className="text-white font-black text-xs uppercase tracking-widest mb-1 opacity-70">
                      Working Hours (IST)
                    </h4>
                    <p className="text-white font-bold text-sm">Mon - Sat: 10:00 AM to 07:00 PM</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Form Column */}
            <div className="bg-white text-slate-900 p-8 md:p-10 rounded-[2.5rem] shadow-2xl">
              <h3 className="text-2xl font-black text-slate-900 mb-2">Send an Inquiry</h3>
              <p className="text-sm text-slate-500 font-medium mb-6">
                Fill out the quick form below and our partnership manager will connect with you immediately.
              </p>

              {contactSubmitted ? (
                <div className="p-8 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-3">
                  <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto">
                    <Check size={24} />
                  </div>
                  <h4 className="text-lg font-black text-slate-900">Inquiry Received Successfully!</h4>
                  <p className="text-xs text-slate-600 font-medium">
                    Thank you! Our team will reach out to you on your provided contact details within 15 minutes.
                  </p>
                </div>
              ) : (
                <form className="space-y-5" onSubmit={handleContactSubmit}>
                  <div className="grid md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Full Name / Business Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="Rajesh Patel"
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Email or Mobile *
                      </label>
                      <input
                        type="text"
                        required
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Subject / Service Required
                    </label>
                    <input
                      type="text"
                      value={contactSubject}
                      onChange={(e) => setContactSubject(e.target.value)}
                      placeholder="Service / API Inquiry"
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      How can we help your business?
                    </label>
                    <textarea
                      rows={4}
                      value={contactMessage}
                      onChange={(e) => setContactMessage(e.target.value)}
                      placeholder="Tell us about your shop or platform requirements..."
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 resize-none"
                    ></textarea>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-wider transition-all shadow-xl shadow-indigo-600/25 flex items-center justify-center gap-2 active:scale-98"
                  >
                    <span>Submit Business Inquiry</span>
                    <ArrowRight size={18} />
                  </button>

                  <div className="pt-2 text-center">
                    <a
                      href="https://wa.me/919512180909?text=Hello%20UsePay%20Team%2C%20I%20want%20to%20know%20more%20about%20your%20services%20and%20APIs."
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-xs font-bold text-emerald-600 hover:text-emerald-700"
                    >
                      <Zap size={14} className="fill-current" />
                      <span>Prefer instant chat? Connect on WhatsApp (+91 9512180909)</span>
                    </a>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* --- COMPREHENSIVE FINTECH FOOTER --- */}
      <footer className="bg-slate-950 text-slate-400 py-16 px-6 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto space-y-12">
          {/* Main Footer Links */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
            {/* Col 1 */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <img src="/logo.png" alt="UsePay" className="h-9 w-auto brightness-200" />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                UsePay Fintech Solution Pvt Ltd is India's leading digital financial network, bridging the gap between local retail points and enterprise banking rails.
              </p>
              <div className="flex items-center gap-3 pt-2 text-xs font-bold text-emerald-400">
                <ShieldCheck size={16} /> ISO 27001 Certified Security
              </div>
            </div>

            {/* Col 2 */}
            <div className="space-y-3">
              <p className="text-white text-xs font-black uppercase tracking-widest">Core Services</p>
              <ul className="space-y-2 text-xs">
                <li><button onClick={() => scrollToSection('services')} className="hover:text-white transition-colors">Aadhaar ATM (AEPS)</button></li>
                <li><button onClick={() => scrollToSection('services')} className="hover:text-white transition-colors">BBPS Utility Bill Payments</button></li>
                <li><button onClick={() => scrollToSection('services')} className="hover:text-white transition-colors">Domestic Money Transfer (DMT)</button></li>
                <li><button onClick={() => scrollToSection('services')} className="hover:text-white transition-colors">Mobile & DTH Recharge</button></li>
                <li><button onClick={() => scrollToSection('services')} className="hover:text-white transition-colors">POS & Soundbox Machines</button></li>
              </ul>
            </div>

            {/* Col 3 */}
            <div className="space-y-3">
              <p className="text-white text-xs font-black uppercase tracking-widest">Developer & B2B</p>
              <ul className="space-y-2 text-xs">
                <li><button onClick={() => scrollToSection('api-solutions')} className="hover:text-white transition-colors">Instant Payout API</button></li>
                <li><button onClick={() => scrollToSection('api-solutions')} className="hover:text-white transition-colors">BBPS Bill Payment API</button></li>
                <li><button onClick={() => scrollToSection('api-solutions')} className="hover:text-white transition-colors">DMT Money Transfer API</button></li>
                <li><button onClick={() => scrollToSection('api-solutions')} className="hover:text-white transition-colors">Sandbox Testing Mode</button></li>
                <li><button onClick={() => scrollToSection('contact')} className="hover:text-white transition-colors">B2B Commercials & Pricing</button></li>
              </ul>
            </div>

            {/* Col 4 */}
            <div className="space-y-3">
              <p className="text-white text-xs font-black uppercase tracking-widest">Support & Office</p>
              <div className="text-xs space-y-2 text-slate-400">
                <p className="font-bold text-slate-300">Surat Office:</p>
                <p>413, AR Mall, Opp. Panvel Point, Mota Varachha, Surat, Gujarat 394101</p>
                <p className="pt-1"><strong className="text-slate-300">Phone:</strong> +91 9512180909</p>
                <p><strong className="text-slate-300">Email:</strong> usepay.in@gmail.com</p>
              </div>
            </div>
          </div>

          {/* Bottom Policy & Legal Links */}
          <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-bold">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-slate-400">
              <Link to="/privacy-policy" className="hover:text-indigo-400 transition-colors">Privacy Policy</Link>
              <span className="text-slate-800">•</span>
              <Link to="/terms-and-conditions" className="hover:text-indigo-400 transition-colors">Terms & Conditions</Link>
              <span className="text-slate-800">•</span>
              <Link to="/refund-policy" className="hover:text-indigo-400 transition-colors">Refund Policy</Link>
              <span className="text-slate-800">•</span>
              <Link to="/cancellation-policy" className="hover:text-indigo-400 transition-colors">Cancellation Policy</Link>
            </div>

            <p className="text-slate-500 text-[11px] font-medium">
              © {new Date().getFullYear()} UsePay Fintech Solution Pvt Ltd. All rights reserved.
            </p>
          </div>

          <div className="text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">
            Engineered & Developed By <a href="https://codefixer.in" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:text-indigo-400 transition-colors">Codefixer</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
