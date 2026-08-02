import React, { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, Lock, User, Loader2, KeyRound, Shield, Rocket, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';

interface B2BLoginProps {
  mode?: 'agent' | 'admin' | 'both';
}

export default function B2BLogin({ mode = 'both' }: B2BLoginProps) {
  const navigate = useNavigate();
  const [loginType, setLoginType] = useState<'agent' | 'admin'>(
    mode === 'admin' ? 'admin' : 'agent'
  );
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [error, setError] = useState('');

  const currentMode = mode !== 'both' ? mode : loginType;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!loginId.trim() || !password.trim()) {
      setError('Please enter your Login ID and Password.');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      if (currentMode === 'admin') {
        // Admin Login - Check admin_profiles table
        const { data: adminUser, error: adminError } = await supabase
          .from('admin_profiles')
          .select('id, role')
          .eq('mobile_number', loginId)
          .eq('password', password)
          .single();

        if (adminError || !adminUser) {
          setError('Invalid Admin Mobile Number or Password.');
          setLoading(false);
        } else {
          localStorage.setItem('b2bAdminId', adminUser.id);
          // Trigger Rocket Launch Animation (Orbit around screen then blast off)
          setIsLaunching(true);
          setTimeout(() => {
            navigate('/b2b/admin');
          }, 3100);
        }
      } else {
        // Agent Login - Check b2b_api_credentials
        const { data: b2bCred, error: credError } = await supabase
          .from('b2b_api_credentials')
          .select('id, is_active')
          .eq('b2b_login_id', loginId)
          .eq('b2b_password', password)
          .single();

        if (credError || !b2bCred) {
          setError('Invalid B2B Login ID or Password.');
          setLoading(false);
        } else if (!b2bCred.is_active) {
          setError('Your B2B API access is currently disabled.');
          setLoading(false);
        } else {
          localStorage.setItem('b2bAgentId', b2bCred.id);
          // Trigger Rocket Launch Animation (Orbit around screen then blast off)
          setIsLaunching(true);
          setTimeout(() => {
            navigate('/b2b/agent');
          }, 3100);
        }
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred during login. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#180036] via-[#2a0845] to-[#12002b] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      
      {/* Background Starry Glow & Effects */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40rem] h-[40rem] bg-purple-600/20 blur-[150px] rounded-full" />
        <div className="absolute top-10 left-10 w-72 h-72 bg-indigo-500/15 blur-[120px] rounded-full" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-fuchsia-600/15 blur-[140px] rounded-full" />
        
        {/* Twinkling CSS Stars */}
        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]" />
      </div>

      {/* Mountain Silhouettes at Bottom (Matching Design 2) */}
      <div className="absolute bottom-0 left-0 right-0 w-full pointer-events-none z-0">
        <svg className="w-full h-40 sm:h-56 lg:h-72 object-cover opacity-85" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <path fill="#0a001a" fillOpacity="1" d="M0,192L48,176C96,160,192,128,288,138.7C384,149,480,203,576,213.3C672,224,768,192,864,165.3C960,139,1056,117,1152,128C1248,139,1344,181,1392,202.7L1440,224L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
          <path fill="#170133" fillOpacity="0.7" d="M0,256L60,229.3C120,203,240,149,360,149.3C480,149,600,203,720,218.7C840,235,960,213,1080,192C1200,171,1320,149,1380,138.7L1440,128L1440,320L1380,320C1320,320,1200,320,1080,320C960,320,840,320,720,320C600,320,480,320,360,320C240,320,120,320,60,320L0,320Z"></path>
        </svg>
      </div>

      {/* Rocket Launch Overlay Animation (Full Orbital Circle Around Login Card) */}
      <AnimatePresence>
        {isLaunching && (
          <motion.div
            initial={{ x: 0, y: 240, scale: 0.9, opacity: 1, rotate: 0 }}
            animate={{ 
              x: [0, 280, 0, -280, 100, -300], 
              y: [240, 0, -260, 0, 180, -1300],
              scale: [0.9, 1.1, 1.3, 1.2, 1.5, 4.2], 
              rotate: [0, -90, -180, -270, -315, -315],
              opacity: [1, 1, 1, 1, 1, 0] 
            }}
            exit={{ opacity: 0 }}
            transition={{ 
              duration: 3.0, 
              times: [0, 0.22, 0.44, 0.66, 0.8, 1],
              ease: "easeInOut" 
            }}
            className="fixed z-50 pointer-events-none flex flex-col items-center justify-center left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          >
            <div className="relative flex flex-col items-center">
              <Rocket className="h-24 w-24 text-white drop-shadow-[0_0_45px_rgba(192,132,252,1)]" />
              {/* Glowing Rocket Flame & Trail */}
              <motion.div
                animate={{ scaleY: [1, 1.8, 1], opacity: [0.9, 1, 0.9] }}
                transition={{ repeat: Infinity, duration: 0.12 }}
                className="w-6 h-24 bg-gradient-to-b from-yellow-300 via-orange-500 to-transparent rounded-full -mt-2 blur-[2px] shadow-[0_0_35px_#f97316]"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Logo (UsePay Logo Kept Intact!) */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 mb-6 text-center">
        <div className="flex justify-center mb-3">
          <img 
            src="/logo.png" 
            alt="UsePay Logo" 
            className="h-16 sm:h-20 max-h-24 object-contain filter drop-shadow-[0_4px_20px_rgba(168,85,247,0.4)]" 
          />
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight drop-shadow-md">
          {currentMode === 'admin' ? 'B2B Admin Portal' : 'B2B API Agent Portal'}
        </h2>
        <p className="mt-1.5 text-sm text-purple-200/80 font-medium">
          {currentMode === 'admin' 
            ? 'Sign in to access your B2B Admin Dashboard' 
            : 'Sign in to access your Agent API Dashboard'}
        </p>
      </div>

      {/* Glassmorphism Login Card (Matching Image 2 Design) */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white/10 backdrop-blur-md py-8 px-6 sm:px-10 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] rounded-3xl border border-white/20">
          
          {mode === 'both' && (
            <div className="flex p-1.5 bg-black/30 backdrop-blur-md rounded-full mb-8 border border-white/10">
              <button
                type="button"
                onClick={() => setLoginType('agent')}
                className={`flex-1 py-2.5 text-xs sm:text-sm font-semibold rounded-full transition-all ${
                  loginType === 'agent' 
                    ? 'bg-white text-purple-950 shadow-lg font-bold' 
                    : 'text-purple-200 hover:text-white'
                }`}
              >
                API Agent
              </button>
              <button
                type="button"
                onClick={() => setLoginType('admin')}
                className={`flex-1 py-2.5 text-xs sm:text-sm font-semibold rounded-full transition-all ${
                  loginType === 'admin' 
                    ? 'bg-white text-purple-950 shadow-lg font-bold' 
                    : 'text-purple-200 hover:text-white'
                }`}
              >
                B2B Admin
              </button>
            </div>
          )}

          <h3 className="text-2xl font-bold text-white text-center mb-6 tracking-wide">
            Login
          </h3>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="bg-red-500/20 border border-red-400/50 rounded-2xl p-3.5 flex items-start gap-3 backdrop-blur-md"
                >
                  <ShieldCheck className="h-5 w-5 text-red-300 shrink-0 mt-0.5" />
                  <p className="text-xs sm:text-sm text-red-100 font-medium">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Username / Login ID Field (Pill Rounded Input with Right Icon) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-purple-200/90 pl-3">
                {currentMode === 'admin' ? 'Admin Mobile Number' : 'B2B Login ID'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-full py-3.5 pl-6 pr-12 text-white placeholder-purple-200/40 text-sm outline-none focus:border-white/60 focus:bg-white/20 focus:ring-2 focus:ring-purple-400/40 transition-all font-medium"
                  placeholder={currentMode === 'admin' ? 'Enter mobile number' : 'Enter B2B Login ID'}
                />
                <User className="absolute right-4.5 top-1/2 -translate-y-1/2 h-5 w-5 text-purple-200/80 pointer-events-none" />
              </div>
            </div>

            {/* Password Field (Pill Rounded Input with Right Icon) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-purple-200/90 pl-3">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-full py-3.5 pl-6 pr-12 text-white placeholder-purple-200/40 text-sm outline-none focus:border-white/60 focus:bg-white/20 focus:ring-2 focus:ring-purple-400/40 transition-all font-medium"
                  placeholder="Enter password"
                />
                <Lock className="absolute right-4.5 top-1/2 -translate-y-1/2 h-5 w-5 text-purple-200/80 pointer-events-none" />
              </div>
            </div>

            {/* Sign In Full White Pill Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || isLaunching}
                className="w-full flex items-center justify-center py-3.5 px-6 rounded-full font-bold text-base text-purple-950 bg-white hover:bg-purple-50 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-400 shadow-xl shadow-purple-950/40 disabled:opacity-75 disabled:cursor-not-allowed transition-all gap-2"
              >
                {loading || isLaunching ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin text-purple-900" />
                    <span>{isLaunching ? 'Launching...' : 'Signing In...'}</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <Sparkles className="h-5 w-5 text-purple-900" />
                  </>
                )}
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}
