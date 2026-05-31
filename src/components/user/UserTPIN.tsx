import React, { useState, useEffect } from 'react';
import { Lock, ShieldCheck, Loader2, KeyRound, Eye, EyeOff, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';

interface UserTPINProps {
  userId: string;
}

export default function UserTPIN({ userId }: UserTPINProps) {
  const toast = useToast();
  
  // TPIN settings state
  const [hasTpin, setHasTpin] = useState(false);
  const [dbTpin, setDbTpin] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [fetching, setFetching] = useState(true);

  // Form inputs
  const [currentTpin, setCurrentTpin] = useState('');
  const [newTpin, setNewTpin] = useState('');
  const [confirmTpin, setConfirmTpin] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Toggle visibility of digits
  const [showCurrentPin, setShowCurrentPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Recovery state
  const [forgotLoading, setForgotLoading] = useState(false);
  const [isForgotMode, setIsForgotMode] = useState(false);

  const fetchTpinStatus = async () => {
    setFetching(true);
    try {
      const { data, error } = await supabase
        .from('users_profiles')
        .select('tpin, password, name, email, mobile_number')
        .eq('id', userId)
        .single();
      
      if (!error && data) {
        setUserProfile(data);
        setDbTpin(data.tpin);
        setHasTpin(!!data.tpin && data.tpin.trim().length === 4);
      }
    } catch (err) {
      console.error('Error fetching TPIN status:', err);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchTpinStatus();
  }, [userId]);

  const handleInputChange = (val: string, setter: (v: string) => void) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 4); // Digits only, max 4 chars
    setter(cleaned);
  };

  const handleCreateOrChangeTpin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    // Validations
    if (newTpin.length !== 4 || !/^\d{4}$/.test(newTpin)) {
      setError('New TPIN must be exactly 4 digits.');
      return;
    }

    if (newTpin !== confirmTpin) {
      setError('Confirm TPIN does not match.');
      return;
    }

    if (!password.trim()) {
      setError('Please enter your account password to verify identity.');
      return;
    }

    setLoading(true);

    try {
      // 1. Verify password & current TPIN (if exists)
      if (userProfile.password !== password) {
        throw new Error('Account password is incorrect.');
      }

      if (hasTpin && !isForgotMode) {
        if (!currentTpin || currentTpin.length !== 4) {
          throw new Error('Please enter your current 4-digit TPIN.');
        }
        if (dbTpin !== currentTpin) {
          throw new Error('Current TPIN is incorrect.');
        }
      }

      // 2. Update TPIN in DB
      const { error: updateError } = await supabase
        .from('users_profiles')
        .update({
          tpin: newTpin,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) throw updateError;

      setSuccessMsg(isForgotMode ? 'TPIN reset successfully!' : (hasTpin ? 'TPIN changed successfully!' : 'TPIN created successfully!'));
      toast.success(isForgotMode ? 'TPIN Reset' : (hasTpin ? 'TPIN Changed' : 'TPIN Created'));
      setIsForgotMode(false);

      // Clear input fields
      setCurrentTpin('');
      setNewTpin('');
      setConfirmTpin('');
      setPassword('');

      // Refresh TPIN status
      await fetchTpinStatus();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMsg(null), 3000);

    } catch (err: any) {
      console.error('TPIN action error:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotTpin = async () => {
    if (!hasTpin || !dbTpin) {
      toast.error('You have not created a TPIN yet.');
      return;
    }

    if (!userProfile?.email) {
      toast.error('No email address registered with this account.');
      return;
    }

    setForgotLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const emailResponse = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: userProfile.email,
          subject: 'Transaction PIN Recovery - UsePay',
          text: `Hello ${userProfile.name},\n\nWe received a request to recover your Transaction PIN (TPIN). Please find it below:\n\nYour 4-Digit TPIN: ${dbTpin}\n\nIf you did not request this, please contact support immediately.\n\nThis is an automated message from UsePay.`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 16px;">
              <h2 style="color: #059669; margin-bottom: 24px;">TPIN Recovery</h2>
              <p style="font-size: 16px; line-height: 1.6;">Hello ${userProfile.name},</p>
              <p style="font-size: 16px; line-height: 1.6;">We received a request to recover your Transaction PIN (TPIN). Please find it below:</p>
              
              <div style="background: #f0fdf4; padding: 24px; border-radius: 12px; margin: 24px 0; border: 1px solid #dcfce7; text-align: center;">
                <p style="margin: 8px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; color: #047857; font-weight: bold;">Your 4-Digit TPIN</p>
                <p style="margin: 0; font-size: 36px; font-weight: 900; letter-spacing: 0.3em; color: #065f46; font-family: monospace;">${dbTpin}</p>
              </div>
              
              <p style="font-size: 14px; color: #64748b; margin-top: 24px;">If you did not request this, please contact support immediately.</p>
              
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 32px 0;" />
              <p style="font-size: 12px; color: #94a3b8; text-align: center;">This is an automated message from UsePay.</p>
            </div>
          `
        })
      });

      if (!emailResponse.ok) {
        throw new Error('Failed to send recovery email.');
      }

      setSuccessMsg('Your TPIN has been sent to your registered email address.');
      toast.success('TPIN Recovery Mail Sent');
      setTimeout(() => setSuccessMsg(null), 5000);

    } catch (err: any) {
      console.error('Forgot TPIN error:', err);
      toast.error('Recovery failed. Please try again or contact support.');
    } finally {
      setForgotLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading TPIN settings...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-10 text-center">
        <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center text-indigo-600 mx-auto mb-6 shadow-xl shadow-indigo-100/50">
          <ShieldAlert size={40} />
        </div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">
          {isForgotMode ? 'Reset TPIN' : (hasTpin ? 'TPIN Security' : 'Create TPIN')}
        </h2>
        <p className="text-slate-500 mt-2 font-medium">
          {isForgotMode ? 'Reset your Transaction PIN (TPIN) using your account password.' : (hasTpin ? 'Change or recover your 4-digit Transaction PIN (TPIN).' : 'Set up a secure 4-digit Transaction PIN to authorize future payments.')}
        </p>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[32px] p-8 shadow-2xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden"
      >
        <form onSubmit={handleCreateOrChangeTpin} className="space-y-8">
          <div className="space-y-6">
            
            {/* If changing TPIN, ask for Current TPIN */}
            {hasTpin && !isForgotMode && (
              <div className="group">
                <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1 transition-colors group-focus-within:text-indigo-500">
                  Current 4-Digit TPIN
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                  <input
                    required
                    type={showCurrentPin ? 'text' : 'password'}
                    value={currentTpin}
                    onChange={(e) => handleInputChange(e.target.value, setCurrentTpin)}
                    placeholder="••••"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-12 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-mono tracking-widest"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowCurrentPin(!showCurrentPin)} 
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showCurrentPin ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
            )}

            {/* New TPIN & Confirm TPIN */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="group">
                <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1 transition-colors group-focus-within:text-emerald-500">
                  {hasTpin ? 'New 4-Digit TPIN' : 'Create 4-Digit TPIN'}
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
                  <input
                    required
                    type={showNewPin ? 'text' : 'password'}
                    value={newTpin}
                    onChange={(e) => handleInputChange(e.target.value, setNewTpin)}
                    placeholder="••••"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-12 text-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-mono tracking-widest"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowNewPin(!showNewPin)} 
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showNewPin ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div className="group">
                <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1 transition-colors group-focus-within:text-emerald-500">
                  Confirm 4-Digit TPIN
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
                  <input
                    required
                    type={showConfirmPin ? 'text' : 'password'}
                    value={confirmTpin}
                    onChange={(e) => handleInputChange(e.target.value, setConfirmTpin)}
                    placeholder="••••"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-12 text-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-mono tracking-widest"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowConfirmPin(!showConfirmPin)} 
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showConfirmPin ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="h-px bg-slate-100 w-full opacity-50"></div>

            {/* Account Password for Security Verification */}
            <div className="group">
              <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1 transition-colors group-focus-within:text-indigo-500">
                Verify Account Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
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
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

          </div>

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600">
              <AlertCircle size={20} className="shrink-0" />
              <p className="text-xs font-bold leading-tight">{error}</p>
            </div>
          )}

          {successMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 text-emerald-600 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <CheckCircle2 size={20} className="shrink-0" />
              <p className="text-xs font-bold leading-tight">{successMsg}</p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4">
            {hasTpin && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setSuccessMsg(null);
                  setIsForgotMode(!isForgotMode);
                }}
                disabled={loading}
                className="flex-1 py-5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-2xl font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 border border-slate-200 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                {isForgotMode ? 'Back to Change' : 'Forgot TPIN?'}
              </button>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`py-5 text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-2xl active:scale-[0.98] disabled:opacity-50 cursor-pointer ${
                hasTpin 
                  ? (isForgotMode ? 'flex-1 bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20' : 'flex-1 bg-slate-900 hover:bg-black shadow-slate-900/20')
                  : 'w-full bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
              }`}
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  <ShieldCheck size={20} />
                  {isForgotMode ? 'Reset TPIN' : (hasTpin ? 'Change TPIN' : 'Create TPIN')}
                </>
              )}
            </button>
          </div>

          <p className="text-[10px] text-center text-slate-400 uppercase font-black tracking-widest">
            Always keep your TPIN confidential • Authorization checks logged
          </p>

        </form>
      </motion.div>
    </div>
  );
}
