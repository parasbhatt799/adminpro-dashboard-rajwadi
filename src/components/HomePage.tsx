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
  FileCode,
  Copy,
  Check,
  Cpu,
  Layers,
  Sparkles,
  ArrowUpRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';

interface HomePageProps {
  isAdmin: boolean;
  isUser: boolean;
  onLogout: () => void;
}

export default function HomePage({ isAdmin, isUser, onLogout }: HomePageProps) {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [activeApiTab, setActiveApiTab] = React.useState<'payout' | 'bbps' | 'dmt'>('payout');
  const [codeViewMode, setCodeViewMode] = React.useState<'request' | 'response'>('request');
  const [copiedCode, setCopiedCode] = React.useState(false);
  const [contactSubject, setContactSubject] = React.useState('General Inquiry');
  const [contactMessage, setContactMessage] = React.useState('');
  const navigate = useNavigate();
  const isLoggedIn = isAdmin || isUser;

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setIsMenuOpen(false);
  };

  const handleRequestApi = (apiName: string) => {
    setContactSubject(`B2B API Integration: ${apiName}`);
    setContactMessage(`Hello UsePay Team, I would like to integrate your ${apiName} into our system. Please share the API Documentation, pricing, and sandbox credentials.`);
    scrollToSection('contact');
  };

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

  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const services = [
    {
      title: 'Recharge Services',
      desc: 'Instant mobile and data recharges with secure and fast processing.',
      icon: Smartphone,
      color: 'bg-indigo-50 text-indigo-600'
    },
    {
      title: 'DTH Recharge',
      desc: 'Quick DTH recharge services with instant activation and confirmation.',
      icon: Tablet,
      color: 'bg-emerald-50 text-emerald-600'
    },
    {
      title: 'Aadhar ATM',
      desc: 'Withdraw cash securely using Aadhaar-enabled payment services.',
      icon: ShieldCheck,
      color: 'bg-amber-50 text-amber-600'
    },
    {
      title: 'Bank Account',
      desc: 'Open and manage bank accounts with easy documentation support.',
      icon: Landmark,
      color: 'bg-blue-50 text-blue-600'
    },
    {
      title: 'Insurance',
      desc: 'Get reliable insurance policies with complete protection coverage.',
      icon: Lock,
      color: 'bg-rose-50 text-rose-600'
    },
    {
      title: 'Ticket Booking',
      desc: 'Book bus, train, and flight tickets easily at best available fares.',
      icon: Ticket,
      color: 'bg-purple-50 text-purple-600'
    },
    {
      title: 'Pan Card',
      desc: 'Apply and update PAN card services with fast processing support.',
      icon: CreditCard,
      color: 'bg-teal-50 text-teal-600'
    },
    {
      title: 'POS Machine',
      desc: 'Accept digital payments easily using modern POS machines.',
      icon: QrCode,
      color: 'bg-slate-50 text-slate-600'
    },
  ];

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 overflow-x-hidden">
      {/* --- HEADER --- */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100 h-20 flex items-center">
        <div className="max-w-7xl mx-auto px-6 w-full flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <img src="/logo.png" alt="UsePay" className="h-10 w-auto" />
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            <button onClick={() => scrollToSection('home')} className="text-sm font-bold text-slate-600 hover:text-indigo-600 transition-colors">Home</button>
            <button onClick={() => scrollToSection('services')} className="text-sm font-bold text-slate-600 hover:text-indigo-600 transition-colors">Our Services</button>
            <button onClick={() => scrollToSection('api-solutions')} className="text-sm font-bold text-slate-600 hover:text-indigo-600 transition-colors flex items-center gap-1.5 group">
              <span>API Suite</span>
              <span className="bg-gradient-to-r from-indigo-600 to-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm group-hover:scale-105 transition-transform">B2B</span>
            </button>
            <button onClick={() => scrollToSection('about')} className="text-sm font-bold text-slate-600 hover:text-indigo-600 transition-colors">About Us</button>
            <button onClick={() => scrollToSection('contact')} className="text-sm font-bold text-slate-600 hover:text-indigo-600 transition-colors">Contact Us</button>
          </nav>

          <div className="flex items-center gap-4">
            {isLoggedIn ? (
              <button
                onClick={() => navigate(isAdmin ? '/dashboard' : '/user/dashboard')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-100 flex items-center gap-2"
              >
                Dashboard <ArrowRight size={16} />
              </button>
            ) : (
              <Link
                to="/login"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-100"
              >
                Login
              </Link>
            )}

            <button
              className="md:hidden p-2 text-slate-600"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-white pt-24 px-6 md:hidden"
          >
            <nav className="flex flex-col gap-6">
              <button onClick={() => scrollToSection('home')} className="text-2xl font-bold text-slate-900 border-b border-slate-100 pb-4 text-left">Home</button>
              <button onClick={() => scrollToSection('services')} className="text-2xl font-bold text-slate-900 border-b border-slate-100 pb-4 text-left">Our Services</button>
              <button onClick={() => scrollToSection('api-solutions')} className="text-2xl font-bold text-slate-900 border-b border-slate-100 pb-4 text-left flex items-center justify-between">
                <span>API Solutions</span>
                <span className="bg-indigo-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">B2B</span>
              </button>
              <button onClick={() => scrollToSection('about')} className="text-2xl font-bold text-slate-900 border-b border-slate-100 pb-4 text-left">About Us</button>
              <button onClick={() => scrollToSection('contact')} className="text-2xl font-bold text-slate-900 border-b border-slate-100 pb-4 text-left">Contact Us</button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- HERO SECTION --- */}
      <section id="home" className="pt-40 pb-20 md:pt-56 md:pb-32 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-8"
          >
            <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest leading-none">
              <Zap size={14} className="fill-current" /> UsePay Fintech Solution Pvt Ltd
            </div>
            <h1 className="text-5xl md:text-7xl font-black text-slate-900 leading-[1.1]">
              Seamless Digital <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-emerald-500">Payments</span> For Everyone
            </h1>
            <p className="text-lg text-slate-500 font-medium max-w-lg leading-relaxed">
              Empowering your connectivity with a unified platform for Mobile, DTH, and Data Card recharges — built with enterprise-grade security and lightning-fast processing.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={() => scrollToSection('services')}
                className="bg-slate-900 hover:bg-slate-800 text-white px-10 py-5 rounded-2xl font-black transition-all flex items-center gap-2 shadow-xl shadow-slate-200"
              >
                Get Started <ChevronRight size={20} />
              </button>
              <button
                onClick={() => scrollToSection('about')}
                className="bg-white border-2 border-slate-100 hover:border-indigo-100 text-slate-600 px-10 py-5 rounded-2xl font-black transition-all"
              >
                Learn More
              </button>
            </div>

            <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-50">
              <div>
                <h3 className="text-3xl font-black text-slate-900">7.1k+</h3>
                <p className="text-sm text-slate-500 font-bold uppercase tracking-wider mt-1">Tickets Resolved</p>
              </div>
              <div>
                <h3 className="text-3xl font-black text-slate-900">50k+</h3>
                <p className="text-sm text-slate-500 font-bold uppercase tracking-wider mt-1">Community Members</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-emerald-500/20 rounded-[4rem] blur-3xl -z-10 animate-pulse"></div>
            <img
              src="https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&q=80&w=1000"
              alt="Fintech App"
              className="rounded-[3rem] shadow-2xl border-8 border-white w-full object-cover aspect-[4/5] md:aspect-auto"
            />

            {/* Floating Stats UI */}
            <div className="absolute top-12 -left-8 bg-white p-4 rounded-2xl shadow-xl border border-slate-50 hidden md:block">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase">Security</p>
                  <p className="text-sm font-black text-slate-900">100% Encrypted</p>
                </div>
              </div>
            </div>

            <div className="absolute bottom-12 -right-8 bg-white p-6 rounded-3xl shadow-2xl border border-slate-50 hidden lg:block">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                  <Zap size={24} />
                </div>
                <div>
                  <p className="text-xl font-black text-slate-900">Instant</p>
                  <p className="text-xs text-slate-500 font-bold">Fast Settlements</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* --- STATS SECTION --- */}
      <section className="bg-slate-900 py-16 px-6">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between gap-12">
          <div className="text-center flex-1 min-w-[200px]">
            <h4 className="text-4xl font-black text-white">4.8/5</h4>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-2">Product Rating</p>
          </div>
          <div className="text-center flex-1 min-w-[200px]">
            <h4 className="text-4xl font-black text-white">100%</h4>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-2">Security Gurantee</p>
          </div>
          <div className="text-center flex-1 min-w-[200px]">
            <h4 className="text-4xl font-black text-white">24/7</h4>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-2">Expert Support</p>
          </div>
          <div className="text-center flex-1 min-w-[200px]">
            <h4 className="text-4xl font-black text-white">0.3s</h4>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-2">Avg Processing</p>
          </div>
        </div>
      </section>

      {/* --- SERVICES SECTION --- */}
      <section id="services" className="py-24 md:py-32 bg-slate-50 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h5 className="text-sm font-black text-indigo-600 uppercase tracking-[0.2em] mb-4">Our Services</h5>
            <h2 className="text-4xl md:text-5xl font-black text-slate-900">What We Do</h2>
            <p className="text-slate-500 font-medium max-w-xl mx-auto mt-4">
              Providing a comprehensive suite of digital financial tools tailored for modern business needs.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {services.map((item, idx) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group"
                >
                  <div className={`w-14 h-14 ${item.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                    <Icon size={28} />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 mb-2">{item.title}</h3>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6">
                    {item.desc}
                  </p>
                  <button className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1 hover:gap-2 transition-all">
                    Read More <ChevronRight size={14} />
                  </button>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* --- B2B & DEVELOPER API SUITE SECTION --- */}
      <section id="api-solutions" className="py-24 md:py-32 bg-slate-950 text-white relative px-6 overflow-hidden">
        {/* Ambient Glows */}
        <div className="absolute top-1/4 -left-48 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 -right-48 w-96 h-96 bg-emerald-500/20 rounded-full blur-[120px] pointer-events-none"></div>

        <div className="max-w-7xl mx-auto relative z-10">
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto mb-20">
            <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest leading-none mb-6">
              <Code2 size={16} /> B2B Developer APIs & SDKs
            </div>
            <h2 className="text-4xl md:text-6xl font-black text-white leading-tight tracking-tight">
              Powerful Fintech APIs <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-emerald-400 to-teal-300">
                Built For Modern Platforms
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
                  Disburse payouts to any bank account in India 24x7x365. Ideal for instant vendor payments, user withdrawals, and salary disburals.
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
                <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden font-mono text-xs">
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
                    <pre className="text-indigo-300">
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

      {/* --- ABOUT SECTION --- */}
      <section id="about" className="py-24 md:py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-20 items-center">
            <div className="relative">
              <img
                src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&q=80&w=1000"
                alt="Fintech Team"
                className="rounded-[3rem] shadow-2xl relative z-10"
              />
              <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -z-10"></div>
              <div className="absolute -top-10 -right-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -z-10"></div>
            </div>

            <div className="space-y-8">
              <div>
                <h5 className="text-sm font-black text-indigo-600 uppercase tracking-[0.2em] mb-4">Who we are</h5>
                <h2 className="text-4xl md:text-5xl font-black text-slate-900 leading-[1.1]">Transforming Digital Finance For The Better</h2>
              </div>

              <div className="space-y-6">
                <div className="flex gap-4 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-md text-emerald-500 shrink-0">
                    <Globe size={24} />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900">Our Mission</h4>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed mt-1">To empower individuals with innovative financial tools that enhance efficiency, transparency, and security in every transaction.</p>
                  </div>
                </div>

                <div className="flex gap-4 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-md text-indigo-500 shrink-0">
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900">Our Vision</h4>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed mt-1">To become a global leader in fintech innovation by creating secure, intelligent, and highly accessible financial solutions for everyone.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- CONTACT SECTION --- */}
      <section id="contact" className="px-6 mb-24">
        <div className="max-w-7xl mx-auto bg-indigo-600 rounded-[3.5rem] p-8 md:p-16 lg:p-20 relative overflow-hidden shadow-2xl shadow-indigo-200">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
            <div className="absolute -top-20 -left-20 w-80 h-80 bg-white rounded-full blur-[100px]"></div>
            <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-white rounded-full blur-[100px]"></div>
          </div>

          <div className="relative z-10 grid lg:grid-cols-2 gap-16 items-start">
            {/* Info Column */}
            <div className="space-y-10">
              <div className="space-y-4">
                <h2 className="text-4xl md:text-5xl font-black text-white leading-tight">Get In Touch With <br />Our Expert Team</h2>
                <p className="text-indigo-100 text-lg font-medium opacity-80 max-w-md">
                  We are here to help you scale your business with the best digital payment tools in the industry.
                </p>
              </div>

              <div className="grid gap-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white shrink-0">
                    <MapPin size={24} />
                  </div>
                  <div>
                    <h4 className="text-white font-black text-xs uppercase tracking-widest mb-1 opacity-60">Company Address</h4>
                    <p className="text-white font-bold leading-relaxed">
                      413,AR mall opp.panvel point Motavarachha<br />Surat Gujarat 394101
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white shrink-0">
                    <Phone size={24} />
                  </div>
                  <div>
                    <h4 className="text-white font-black text-xs uppercase tracking-widest mb-1 opacity-60">Phone Support</h4>
                    <p className="text-white font-bold text-xl">+91 9512180909</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white shrink-0">
                    <Mail size={24} />
                  </div>
                  <div>
                    <h4 className="text-white font-black text-xs uppercase tracking-widest mb-1 opacity-60">Email Address</h4>
                    <p className="text-white font-bold">usepay.in@gmail.com</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white shrink-0">
                    <Clock size={24} />
                  </div>
                  <div>
                    <h4 className="text-white font-black text-xs uppercase tracking-widest mb-1 opacity-60">Working Hours (IST)</h4>
                    <p className="text-white font-bold text-sm">Mon - Sat: 10:00 AM to 07:00 PM</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Form Column */}
            <div className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-xl">
              <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Full Name</label>
                    <input
                      type="text"
                      placeholder="John Doe"
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email Address</label>
                    <input
                      type="email"
                      placeholder="john@example.com"
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Subject</label>
                  <input
                    type="text"
                    value={contactSubject}
                    onChange={(e) => setContactSubject(e.target.value)}
                    placeholder="General Inquiry"
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">How can we help?</label>
                  <textarea
                    rows={4}
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                    placeholder="Tell us about your requirements..."
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300 resize-none"
                  ></textarea>
                </div>

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-5 rounded-2xl font-black transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                >
                  Send Message <ArrowRight size={20} />
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer id="contact" className="bg-slate-900 py-12 px-6">
        <div className="max-w-7xl mx-auto text-center space-y-6">
          {/* Policy Links */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-bold uppercase tracking-wider text-slate-400">
            <Link to="/privacy-policy" className="hover:text-indigo-400 transition-colors">Privacy Policy</Link>
            <span className="text-slate-700 hidden sm:inline">•</span>
            <Link to="/terms-and-conditions" className="hover:text-indigo-400 transition-colors">Terms & Conditions</Link>
            <span className="text-slate-700 hidden sm:inline">•</span>
            <Link to="/refund-policy" className="hover:text-indigo-400 transition-colors">Refund Policy</Link>
            <span className="text-slate-700 hidden sm:inline">•</span>
            <Link to="/cancellation-policy" className="hover:text-indigo-400 transition-colors">Cancellation Policy</Link>
          </div>

          <div className="space-y-4">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">
              © {new Date().getFullYear()} UsePay Fintech Solution Pvt Ltd. All rights reserved.
            </p>
            <p className="text-slate-600 text-[10px] font-black uppercase tracking-[0.2em]">
              Developed By <a href="https://codefixer.in" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:text-indigo-400 transition-colors">Codefixer</a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
