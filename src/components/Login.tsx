import { useState, type FormEvent } from 'react';
import { ShieldCheck, ArrowRight, Lock, User, Loader2, X, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';

interface LoginProps {
  onLogin: (id: string, userType: 'admin' | 'user') => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Forgot Password States
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotMobile, setForgotMobile] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
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
        // ... (existing logic)
        const authenticatedPhone = authData.user.phone || '';
        const normalizedPhone = authenticatedPhone.replace('+', '');
        
        const { data: adminProfile } = await supabase
          .from('admin_profiles')
          .select('mobile_number')
          .filter('mobile_number', 'in', `(${id},${normalizedPhone},${normalizedPhone.slice(-10)})`)
          .single();

        if (adminProfile) {
          onLogin(adminProfile.mobile_number, 'admin');
          return;
        } else {
          setError('Authorized admin profile not found for this account');
          return;
        }
      }

      // 2. Check for User in Database (Legacy Flow)
      const { data, error: dbError } = await supabase
        .from('users_profiles')
        .select('id, mobile_number, password, status')
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
          subject: 'Account Recovery - Rajwadi',
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
              <p style="font-size: 12px; color: #94a3b8; text-align: center;">This is an automated message from Rajwadi.</p>
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

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
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
          </div>

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
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="••••••••••"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-mono tracking-widest"
                />
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

          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <p className="text-xs text-slate-500">
              Authorized personnel only. All access attempts are logged.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Forgot Password Modal */}
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
    </div>
  );
}

