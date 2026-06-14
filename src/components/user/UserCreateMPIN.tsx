import React, { useState } from 'react';
import { Lock, ShieldCheck, Loader2, KeyRound, Eye, EyeOff, AlertCircle, CheckCircle2, LogOut } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';

interface UserCreateMPINProps {
  userId: string;
  onSuccess: () => void;
  onLogout: () => void;
}

export default function UserCreateMPIN({ userId, onSuccess, onLogout }: UserCreateMPINProps) {
  const toast = useToast();
  
  const [newMpin, setNewMpin] = useState('');
  const [confirmMpin, setConfirmMpin] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleInputChange = (val: string, setter: (v: string) => void) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 6); // Numeric only, max 6 digits
    setter(cleaned);
  };

  const handleCreateMpin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    // Validation
    if (newMpin.length !== 6 || !/^\d{6}$/.test(newMpin)) {
      setError('MPIN must be exactly 6 digits.');
      return;
    }

    if (newMpin !== confirmMpin) {
      setError('Confirm MPIN does not match.');
      return;
    }

    if (!password.trim()) {
      setError('Please enter your account password to verify identity.');
      return;
    }

    setLoading(true);

    try {
      // 1. Fetch user password to verify
      const { data: user, error: fetchErr } = await supabase
        .from('users_profiles')
        .select('password')
        .eq('id', userId)
        .single();

      if (fetchErr || !user) {
        throw new Error('Could not verify account identity.');
      }

      if (user.password !== password) {
        throw new Error('Account password is incorrect.');
      }

      // 2. Update MPIN in database
      const { error: updateError } = await supabase
        .from('users_profiles')
        .update({
          mpin: newMpin,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) throw updateError;

      setSuccessMsg('6-Digit Login MPIN created successfully!');
      toast.success('Login MPIN Created');

      // Clear fields
      setNewMpin('');
      setConfirmMpin('');
      setPassword('');

      // Callback to refresh profile in parent component
      setTimeout(() => {
        onSuccess();
      }, 1500);

    } catch (err: any) {
      console.error('Create MPIN error:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-600/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px]"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white rounded-[32px] p-8 shadow-2xl border border-slate-100 relative overflow-hidden"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mx-auto mb-4 shadow-inner">
            <ShieldCheck size={36} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Create Login MPIN</h2>
          <p className="text-slate-500 text-sm mt-2 font-medium">
            Please set a secure 6-digit Mobile PIN (MPIN) to protect your account during login.
          </p>
        </div>

        <form onSubmit={handleCreateMpin} className="space-y-6">
          <div className="space-y-5">
            {/* New MPIN */}
            <div className="group">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                Create 6-Digit MPIN
              </label>
              <div className="relative">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
                <input
                  required
                  type={showNewPin ? 'text' : 'password'}
                  value={newMpin}
                  onChange={(e) => handleInputChange(e.target.value, setNewMpin)}
                  placeholder="••••••"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-12 text-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-mono tracking-[0.3em]"
                />
                <button 
                  type="button" 
                  onClick={() => setShowNewPin(!showNewPin)} 
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showNewPin ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Confirm MPIN */}
            <div className="group">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                Confirm 6-Digit MPIN
              </label>
              <div className="relative">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
                <input
                  required
                  type={showConfirmPin ? 'text' : 'password'}
                  value={confirmMpin}
                  onChange={(e) => handleInputChange(e.target.value, setConfirmMpin)}
                  placeholder="••••••"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-12 text-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-mono tracking-[0.3em]"
                />
                <button 
                  type="button" 
                  onClick={() => setShowConfirmPin(!showConfirmPin)} 
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showConfirmPin ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="h-px bg-slate-100 w-full opacity-60"></div>

            {/* Verify Password */}
            <div className="group">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                Account Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                <input
                  required
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-12 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-mono tracking-widest"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)} 
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600">
              <AlertCircle size={18} className="shrink-0" />
              <p className="text-xs font-bold leading-tight">{error}</p>
            </div>
          )}

          {successMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 text-emerald-600">
              <CheckCircle2 size={18} className="shrink-0" />
              <p className="text-xs font-bold leading-tight">{successMsg}</p>
            </div>
          )}

          <div className="flex gap-4">
            <button
              type="button"
              onClick={onLogout}
              disabled={loading}
              className="flex-1 py-4 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-2xl font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 border border-slate-200 transition-all active:scale-[0.98]"
            >
              <LogOut size={16} />
              Logout
            </button>

            <button
              type="submit"
              disabled={loading}
              className="flex-[2] py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-xl shadow-emerald-600/20 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                'Set MPIN'
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
