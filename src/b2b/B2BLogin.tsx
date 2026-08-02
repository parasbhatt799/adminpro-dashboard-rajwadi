import React, { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, ArrowRight, Lock, User, Loader2, KeyRound, Shield } from 'lucide-react';
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
        } else {
          localStorage.setItem('b2bAdminId', adminUser.id);
          navigate('/b2b/admin');
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
        } else if (!b2bCred.is_active) {
          setError('Your B2B API access is currently disabled.');
        } else {
          localStorage.setItem('b2bAgentId', b2bCred.id);
          navigate('/b2b/agent');
        }
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred during login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/40 to-slate-900/90" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[40rem] bg-indigo-500/10 blur-[120px] rounded-full" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center mb-4">
          <img src="/logo.png" alt="Logo" className="h-16 max-h-20 object-contain drop-shadow-xl" />
        </div>
        <h2 className="mt-2 text-center text-3xl font-extrabold text-white tracking-tight">
          {currentMode === 'admin' ? 'B2B Admin Portal' : 'B2B API Agent Portal'}
        </h2>
        <p className="mt-2 text-center text-sm text-indigo-200">
          {currentMode === 'admin' 
            ? 'Sign in to access your B2B Admin Dashboard' 
            : 'Sign in to access your Agent API Dashboard'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white/10 backdrop-blur-xl py-8 px-4 shadow-2xl sm:rounded-2xl sm:px-10 border border-white/10">
          
          {mode === 'both' && (
            <div className="flex p-1 bg-black/20 rounded-lg mb-8">
              <button
                type="button"
                onClick={() => setLoginType('agent')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                  loginType === 'agent' 
                    ? 'bg-indigo-600 text-white shadow-lg' 
                    : 'text-indigo-200 hover:text-white hover:bg-white/5'
                }`}
              >
                API Agent
              </button>
              <button
                type="button"
                onClick={() => setLoginType('admin')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                  loginType === 'admin' 
                    ? 'bg-indigo-600 text-white shadow-lg' 
                    : 'text-indigo-200 hover:text-white hover:bg-white/5'
                }`}
              >
                B2B Admin
              </button>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 flex items-start gap-3"
                >
                  <ShieldCheck className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-200">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="block text-sm font-medium text-indigo-100">
                {currentMode === 'admin' ? 'Admin Mobile Number' : 'B2B Login ID'}
              </label>
              <div className="mt-2 relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-indigo-300" />
                </div>
                <input
                  type="text"
                  required
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-white/10 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-black/20 text-white placeholder-indigo-300/50 sm:text-sm transition-colors"
                  placeholder={currentMode === 'admin' ? 'Enter your mobile number' : 'Enter your B2B Login ID'}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-indigo-100">
                Password
              </label>
              <div className="mt-2 relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-indigo-300" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-white/10 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-black/20 text-white placeholder-indigo-300/50 sm:text-sm transition-colors"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  Sign in
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
