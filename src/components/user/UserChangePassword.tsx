import React, { useState } from 'react';
import { Lock, ShieldCheck, Loader2, KeyRound, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';

interface UserChangePasswordProps {
  userId: string;
  onLogout: () => void;
}

export default function UserChangePassword({ userId, onLogout }: UserChangePasswordProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic Validations
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      // 1. Verify Current Password
      const { data: user, error: fetchError } = await supabase
        .from('users_profiles')
        .select('password')
        .eq('id', userId)
        .single();

      if (fetchError || !user) throw new Error('Could not verify identity. Please log in again.');
      
      if (user.password !== currentPassword) {
        throw new Error('Current password is incorrect.');
      }

      // 2. Update Password
      const { error: updateError } = await supabase
        .from('users_profiles')
        .update({ 
          password: newPassword,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) throw updateError;

      setSuccess(true);
      
      // 3. Automatic Logout
      setTimeout(() => {
        onLogout();
      }, 3000);

    } catch (err: any) {
      console.error('Change password error:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <div className="mb-10 text-center">
        <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center text-emerald-600 mx-auto mb-6 shadow-xl shadow-emerald-100/50">
          <KeyRound size={40} />
        </div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Security Center</h2>
        <p className="text-slate-500 mt-2 font-medium">Update your account password to stay protected.</p>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[32px] p-8 shadow-2xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden"
      >
        <AnimatePresence mode="wait">
          {success ? (
            <motion.div 
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-12"
            >
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mx-auto mb-6">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Password Updated!</h3>
              <p className="text-slate-500 mb-8 max-w-xs mx-auto">
                Your security credentials have been updated successfully. You will be logged out in a few seconds...
              </p>
              <div className="flex items-center justify-center gap-2 text-emerald-600 font-black text-xs uppercase tracking-widest">
                <Loader2 className="animate-spin" size={14} />
                Finalizing Security...
              </div>
            </motion.div>
          ) : (
            <motion.form 
              key="form"
              exit={{ opacity: 0, scale: 0.95 }}
              onSubmit={handleSubmit} 
              className="space-y-8"
            >
              <div className="space-y-6">
                {/* Current Password */}
                <div className="group">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1 transition-colors group-focus-within:text-emerald-500">
                    Current Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
                    <input
                      required
                      type={showCurrentPwd ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-12 text-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-mono tracking-widest"
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowCurrentPwd(!showCurrentPwd)} 
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showCurrentPwd ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <div className="h-px bg-slate-100 w-full opacity-50"></div>

                {/* New Password */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="group">
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1 transition-colors group-focus-within:text-indigo-500">
                      New Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                      <input
                        required
                        type={showNewPwd ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-12 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-mono tracking-widest"
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowNewPwd(!showNewPwd)} 
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showNewPwd ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>

                  <div className="group">
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1 transition-colors group-focus-within:text-indigo-500">
                      Repeat Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                      <input
                        required
                        type={showConfirmPwd ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-12 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-mono tracking-widest"
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowConfirmPwd(!showConfirmPwd)} 
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showConfirmPwd ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 animate-shake">
                  <AlertCircle size={20} className="shrink-0" />
                  <p className="text-xs font-bold leading-tight">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-5 bg-slate-900 hover:bg-black text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-2xl shadow-slate-900/20 active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    <ShieldCheck size={20} />
                    Update Profile Password
                  </>
                )}
              </button>
              
              <p className="text-[10px] text-center text-slate-400 uppercase font-black tracking-widest mt-6">
                Authorized access only • All sessions will be terminated on change
              </p>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
