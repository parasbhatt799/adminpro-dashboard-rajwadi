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
  ChevronRight
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
  const navigate = useNavigate();
  const isLoggedIn = isAdmin || isUser;

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setIsMenuOpen(false);
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
              <Zap size={14} className="fill-current" /> Next-Gen Fintech Solution
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

              <div className="pt-4">
                <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-4 rounded-2xl font-black transition-all shadow-lg shadow-indigo-100">
                  Work With Us
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- CTA SECTION --- */}
      <section className="px-6 mb-24">
        <div className="max-w-7xl mx-auto bg-indigo-600 rounded-[3.5rem] p-12 md:p-24 text-center space-y-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
             <div className="absolute -top-20 -left-20 w-80 h-80 bg-white rounded-full blur-[100px]"></div>
             <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-white rounded-full blur-[100px]"></div>
          </div>
          
          <h2 className="text-4xl md:text-6xl font-black text-white relative z-10 leading-[1.1]">Have Any Questions? Get In Touch With Our Team.</h2>
          <p className="text-indigo-100 text-lg md:text-xl font-medium max-w-2xl mx-auto relative z-10 opacity-80">
            We are here to help you scale your business with the best digital payment tools in the industry.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 relative z-10">
            <a href="mailto:info@usepay.com" className="bg-white text-indigo-600 px-12 py-5 rounded-2xl font-black transition-all hover:scale-105 active:scale-95 shadow-2xl">
              Contact Us Now
            </a>
          </div>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer id="contact" className="bg-slate-900 py-12 px-6">
        <div className="max-w-7xl mx-auto text-center space-y-4">
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">
            © {new Date().getFullYear()} UsePay Pvt Ltd. All rights reserved.
          </p>
          <p className="text-slate-600 text-[10px] font-black uppercase tracking-[0.2em]">
            Developed By <a href="https://codefixer.in" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:text-indigo-400 transition-colors">Codefixer</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
