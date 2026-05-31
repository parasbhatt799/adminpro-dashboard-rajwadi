import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, ArrowRight, Lock, User, Loader2, X, Mail, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';

interface LoginProps {
  onLogin: (id: string, userType: 'admin' | 'user', role?: string, permissions?: string[]) => void;
  isAdminMode?: boolean;
}

// Live Simulated Transaction Feed Component for Default Banner
function TransactionFeed() {
  const [items, setItems] = useState([
    { id: 1, type: 'IN', amount: '₹5,420', desc: 'UPI Collection Successful', time: 'Just now', dot: 'bg-emerald-500' },
    { id: 2, type: 'OUT', amount: '₹12,000', desc: 'Payout Node B Settlement', time: '1s ago', dot: 'bg-indigo-500' },
    { id: 3, type: 'BBPS', amount: '₹1,250', desc: 'BBPS Utility Bill Paid', time: '3s ago', dot: 'bg-cyan-500' }
  ]);

  useEffect(() => {
    const timer = setInterval(() => {
      setItems(prev => {
        const next = [...prev];
        const last = next.pop()!;
        
        // Randomize amount slightly for live feel
        const randAmount = Math.floor(Math.random() * 8000) + 500;
        const newTypes = [
          { type: 'IN', desc: 'UPI Collection Successful', dot: 'bg-emerald-500' },
          { type: 'OUT', desc: 'Payout Node B Settlement', dot: 'bg-indigo-500' },
          { type: 'BBPS', desc: 'BBPS Utility Bill Paid', dot: 'bg-cyan-500' }
        ];
        const randomType = newTypes[Math.floor(Math.random() * newTypes.length)];
        
        const updatedItem = {
          id: Date.now(),
          type: randomType.type,
          amount: `₹${randAmount.toLocaleString('en-IN')}`,
          desc: randomType.desc,
          time: 'Just now',
          dot: randomType.dot
        };
        
        // Update older item times
        const shifted = next.map(item => ({
          ...item,
          time: item.time === 'Just now' ? '2s ago' : item.time === '2s ago' ? '4s ago' : '5s ago'
        }));

        return [updatedItem, ...shifted];
      });
    }, 3000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-2.5">
      <AnimatePresence initial={false}>
        {items.slice(0, 3).map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.4 }}
            className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl backdrop-blur-md hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-3">
              {/* Type Badge Dot */}
              <div className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${item.dot} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${item.dot}`}></span>
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-white">{item.desc}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{item.time}</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-black text-white">{item.amount}</span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export default function Login({ onLogin, isAdminMode = false }: LoginProps) {
  const navigate = useNavigate();
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Forgot Password States
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotMobile, setForgotMobile] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');

  // Advertisement settings state
  const [adSettings, setAdSettings] = useState<{ banner_url: string; redirect_link: string } | null>(null);

  // Fetch advertisement details if not in admin login mode
  useEffect(() => {
    if (isAdminMode) return;
    const fetchAdSettings = async () => {
      try {
        const { data } = await supabase
          .from('advertising')
          .select('banner_url, redirect_link')
          .eq('id', 1)
          .single();
        if (data) {
          setAdSettings({
            banner_url: data.banner_url || '',
            redirect_link: data.redirect_link || ''
          });
        }
      } catch (err) {
        console.error('Error fetching advertising banner:', err);
      }
    };
    fetchAdSettings();
  }, [isAdminMode]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!id.trim() || !password.trim()) {
      setError('Please enter your Access ID and Password.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      // Normalize the login ID (add +91 for admins)
      const loginId = id.startsWith('+') ? id : `+91${id.replace(/^0+/, '')}`;

      // 1. Try Secure Admin Login via Supabase Auth (Mobile & Password)
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        phone: loginId,
        password: password,
      });

      if (authError) {
        // Fallback to legacy user check if auth fails
        console.warn('Auth login failed, falling back to legacy:', authError.message);
      }

      if (authData.user && !authError) {
        // Use the phone number from the authenticated user to handle country codes (+91)
        const authenticatedPhone = authData.user.phone || '';
        const normalizedPhone = authenticatedPhone.replace('+', '');

        // Verify this mobile number exists in admin_profiles
        // We check for exact match or the number without the country code
        const { data: adminProfile } = await supabase
          .from('admin_profiles')
          .select('mobile_number, role, status, permissions')
          .filter('mobile_number', 'in', `(${id},${normalizedPhone},${normalizedPhone.slice(-10)})`)
          .single();

        if (adminProfile) {
          if (adminProfile.status === 'Blocked') {
            setError('Your account has been blocked by a senior admin');
            return;
          }
          onLogin(adminProfile.mobile_number, 'admin', adminProfile.role || 'full', adminProfile.permissions || []);
          navigate('/dashboard');
          return;
        }
      }

      // 1.2 FALLBACK: Check for Admin in Legacy Database (Plain Text)
      const { data: legacyAdmin } = await supabase
        .from('admin_profiles')
        .select('mobile_number, role, status, permissions')
        .eq('mobile_number', id)
        .eq('password', password)
        .single();

      if (legacyAdmin) {
        if (legacyAdmin.status === 'Blocked') {
          setError('Your account has been blocked by a senior admin');
          return;
        }
        onLogin(legacyAdmin.mobile_number, 'admin', legacyAdmin.role || 'full', legacyAdmin.permissions || []);
        navigate('/dashboard');
        return;
      }

      // 2. Check for User in Database (Legacy Flow)
      const { data, error: dbError } = await supabase
        .from('users_profiles')
        .select('id, mobile_number, password, status, role')
        .eq('mobile_number', id)
        .eq('password', password)
        .single();

      if (dbError || !data) {
        // If both Auth and Legacy DB fail, show the specific Auth error if it's relevant
        if (authError && authError.message !== 'Invalid login credentials') {
          setError(`Security Error: ${authError.message}`);
        } else {
          setError('Invalid Mobile Number or Password');
        }
        return;
      }

      if (data.status === 'Suspended') {
        setError('You panel blocked by admin');
        return;
      }

      onLogin(data.id, 'user');
      navigate('/user/dashboard');
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'An unexpected error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError('');
    setForgotMessage('');

    try {
      const { data, error: dbError } = await supabase
        .from('users_profiles')
        .select('email, mobile_number, password, name')
        .eq('mobile_number', forgotMobile)
        .single();

      if (dbError || !data) {
        setForgotError('Register Mobile number not found');
        return;
      }

      if (!data.email) {
        setForgotError('No email associated with this account');
        return;
      }

      const emailResponse = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: data.email,
          subject: 'Account Recovery - UsePay',
          text: `Hello ${data.name},\n\nWe received a request to recover your account credentials. Please find them below:\n\nUser ID (Mobile): ${data.mobile_number}\nCurrent Password: ${data.password}\nLogin URL: ${window.location.origin}\n\nIf you did not request this, please contact support immediately.\n\nThis is an automated message from UsePay.`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 16px;">
              <h2 style="color: #4f46e5; margin-bottom: 24px;">Account Recovery</h2>
              <p style="font-size: 16px; line-height: 1.6;">Hello ${data.name},</p>
              <p style="font-size: 16px; line-height: 1.6;">We received a request to recover your account credentials. Please find them below:</p>
              
              <div style="background: #f8fafc; padding: 24px; border-radius: 12px; margin: 24px 0; border: 1px solid #f1f5f9;">
                <p style="margin: 8px 0; font-size: 18px;"><strong>User ID (Mobile):</strong> <span style="color: #0f172a;">${data.mobile_number}</span></p>
                <p style="margin: 8px 0; font-size: 18px;"><strong>Current Password:</strong> <span style="color: #0f172a;">${data.password}</span></p>
              </div>
              
              <p style="font-size: 14px; color: #64748b; margin-top: 24px;">If you did not request this, please contact support immediately.</p>
              
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 32px 0;" />
              <p style="font-size: 12px; color: #94a3b8; text-align: center;">This is an automated message from UsePay.</p>
            </div>
          `
        }),
      });

      if (!emailResponse.ok) {
        throw new Error('Failed to send recovery email');
      }

      setForgotMessage('Success! Your credentials have been sent to your registered email.');
      setTimeout(() => setIsForgotModalOpen(false), 3000);
    } catch (err) {
      console.error('Forgot password error:', err);
      setForgotError('Recovery failed. Please try again or contact support.');
    } finally {
      setForgotLoading(false);
    }
  };

  const renderLoginForm = () => (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">
          Access ID
        </label>
        <div className="relative">
          <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            type="text"
            value={id}
            onChange={(e) => {
              setId(e.target.value);
              setError('');
            }}
            placeholder="Enter ID"
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">
            Password
          </label>
          <button
            type="button"
            onClick={() => setIsForgotModalOpen(true)}
            className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Forgot Password?
          </button>
        </div>
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
            placeholder="••••••••••"
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-12 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-mono tracking-widest"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-rose-500 text-xs font-bold mt-2 ml-1"
          >
            {error}
          </motion.p>
        )}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98] disabled:opacity-50"
      >
        {loading ? <Loader2 className="animate-spin" size={18} /> : 'Verify Identity'}
        {!loading && <ArrowRight size={18} />}
      </button>
    </form>
  );

  const renderForgotModal = () => (
    <AnimatePresence>
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsForgotModalOpen(false)}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-sm relative z-10 bg-slate-900 border border-white/10 p-8 rounded-3xl shadow-2xl"
          >
            <button
              onClick={() => setIsForgotModalOpen(false)}
              className="absolute right-6 top-6 text-slate-500 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-indigo-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Mail className="text-indigo-400" size={32} />
              </div>
              <h3 className="text-xl font-bold text-white">Forgot Password</h3>
              <p className="text-slate-400 text-sm mt-2">Enter your registered mobile number to recover your credentials.</p>
            </div>

            <form onSubmit={handleForgotPassword} className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">
                  Mobile Number
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input
                    type="text"
                    required
                    value={forgotMobile}
                    onChange={(e) => setForgotMobile(e.target.value)}
                    placeholder="Enter mobile number"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-medium"
                  />
                </div>
              </div>

              {forgotError && (
                <p className="text-rose-500 text-xs font-bold text-center">{forgotError}</p>
              )}
              {forgotMessage && (
                <p className="text-emerald-500 text-xs font-bold text-center">{forgotMessage}</p>
              )}

              <button
                type="submit"
                disabled={forgotLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-lg shadow-indigo-600/20"
              >
                {forgotLoading ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <>
                    <span>Send Recovery Mail</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  // Layout for Admin Mode (Centered)
  if (isAdminMode) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 relative">
        <header className="fixed top-0 left-0 right-0 p-6 flex justify-between items-center z-10">
          <span />
          <Link to="/" className="text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors">
            Back to Website
          </Link>
        </header>

        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/10 rounded-full blur-[120px]"></div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md relative z-10"
        >
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl">
            <div className="flex flex-col items-center mb-8">
              <div className="w-50 h-30 rounded-2xl flex items-center justify-center mb-4 p-2">
                <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
              </div>
              <h2 className="text-sm font-bold text-indigo-400 uppercase tracking-widest mt-2">Admin Portal</h2>
            </div>

            {renderLoginForm()}

            <div className="mt-8 pt-6 border-t border-white/5 text-center">
              <p className="text-xs text-slate-500">
                Authorized personnel only. All access attempts are logged.
              </p>
            </div>
          </div>
        </motion.div>

        {renderForgotModal()}
      </div>
    );
  }

  // Layout for User / Distributor Mode (Split-Screen)
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col md:flex-row relative">
      {/* Left Column: Wide Advertisement Banner (Desktop only) */}
      <div className="hidden md:flex md:w-[60%] lg:w-[65%] xl:w-[70%] h-screen relative bg-slate-900 overflow-hidden">
        {adSettings?.banner_url ? (
          <a
            href={adSettings.redirect_link || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full h-full relative group overflow-hidden cursor-pointer"
          >
            <img
              src={adSettings.banner_url}
              alt="Advertisement"
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-slate-950/20 opacity-80 group-hover:opacity-60 transition-opacity duration-300" />
            <div className="absolute bottom-6 right-6 bg-white/10 backdrop-blur-md border border-white/10 px-4 py-2 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <span>Visit Link</span>
              <ArrowRight size={14} />
            </div>
          </a>
        ) : (
          <div className="w-full h-full relative flex flex-col items-center justify-center p-12 overflow-hidden bg-slate-900 select-none">
            {/* Ambient background gradients */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.15),rgba(255,255,255,0))]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_800px_at_50%_400px,rgba(15,23,42,0.4),#0f172a)]" />
            
            {/* Spinning decorative tech circles */}
            <div className="absolute w-[600px] h-[600px] rounded-full border border-indigo-500/5 flex items-center justify-center animate-[spin_80s_linear_infinite]" />
            <div className="absolute w-[450px] h-[450px] rounded-full border border-dashed border-emerald-500/5 flex items-center justify-center animate-[spin_40s_linear_infinite_reverse]" />

            {/* Glowing floating ambient orbs */}
            <div className="absolute top-[10%] left-[10%] w-64 h-64 bg-indigo-500/10 rounded-full blur-[100px] animate-pulse" />
            <div className="absolute bottom-[10%] right-[10%] w-80 h-80 bg-emerald-500/5 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />

            <div className="relative z-10 flex flex-col items-center gap-12 w-full max-w-lg">
              
              {/* Header Title */}
              <div className="text-center space-y-2">
                <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full text-[10px] font-bold uppercase tracking-widest">
                  Secure FinTech Infrastructure
                </span>
                <h3 className="text-2xl font-black text-white tracking-tight mt-2">Next-Gen Payment Network</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Providing unified API systems for payouts, digital collections, and utility services.
                </p>
              </div>

              {/* 3D Tilted Credit Card Container */}
              <motion.div
                whileHover={{ rotateY: 15, rotateX: -10, scale: 1.03 }}
                transition={{ type: "spring", stiffness: 150, damping: 15 }}
                style={{ transformStyle: "preserve-3d", perspective: 1000 }}
                className="w-full max-w-[360px] h-[220px] rounded-3xl bg-gradient-to-br from-white/10 via-white/5 to-white/0 backdrop-blur-xl border border-white/15 p-6 shadow-2xl flex flex-col justify-between relative overflow-hidden group cursor-pointer"
              >
                {/* Holographic reflection highlight on hover */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                
                {/* Top Bar: Brand & Chip */}
                <div className="flex justify-between items-center" style={{ transform: "translateZ(30px)" }}>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
                      <ShieldCheck size={18} />
                    </div>
                    <span className="text-sm font-black text-white tracking-widest">UsePay</span>
                  </div>
                  {/* Metallic gold chip */}
                  <div className="w-10 h-8 rounded-md bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-500 border border-yellow-200/50 shadow-inner flex flex-col p-1 gap-1">
                    <div className="h-full border-r border-yellow-600/20" />
                  </div>
                </div>

                {/* Card Number */}
                <div className="text-lg font-mono text-white tracking-[0.25em] my-4 text-center" style={{ transform: "translateZ(40px)" }}>
                  ••••  ••••  ••••  8824
                </div>

                {/* Bottom Bar: Owner & EXP */}
                <div className="flex justify-between items-end" style={{ transform: "translateZ(30px)" }}>
                  <div>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Authorized Merchant</p>
                    <p className="text-xs font-bold text-white tracking-wider mt-0.5">USEPAY PARTNER NODE</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">EXP END</p>
                    <p className="text-xs font-mono text-white mt-0.5">12/30</p>
                  </div>
                </div>
              </motion.div>

              {/* Live Live Transaction Feed Component */}
              <div className="w-full max-w-[360px] space-y-3">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-left px-1">
                  Live Network Stream
                </p>
                <div className="space-y-2.5">
                  <TransactionFeed />
                </div>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* Right Column: Centered Login Form */}
      <div className="w-full md:w-[40%] lg:w-[35%] xl:w-[30%] min-h-screen bg-slate-900 flex flex-col justify-between p-8 relative">
        <header className="flex justify-between items-center z-10 w-full mb-6">
          <span />
          <Link to="/" className="text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors">
            Back to Website
          </Link>
        </header>

        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[20%] right-[-10%] w-[50%] h-[30%] bg-indigo-600/10 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-[10%] left-[-10%] w-[50%] h-[30%] bg-emerald-600/5 rounded-full blur-[120px]"></div>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full max-w-md mx-auto my-auto relative z-10"
        >
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl">
            <div className="flex flex-col items-center mb-8">
              <div className="w-50 h-30 rounded-2xl flex items-center justify-center mb-4 p-2">
                <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
              </div>
            </div>

            {renderLoginForm()}

            <div className="mt-8 pt-6 border-t border-white/5 text-center">
              <p className="text-xs text-slate-500">
                Authorized personnel only. All access attempts are logged.
              </p>
            </div>
          </div>
        </motion.div>

        <footer className="text-center mt-6 text-[10px] text-slate-600 z-10">
          &copy; {new Date().getFullYear()} UsePay. All rights reserved.
        </footer>
      </div>

      {renderForgotModal()}
    </div>
  );
}
