import { useState, useEffect } from 'react';
import UserSidebar from './UserSidebar';
import UserKYC from './UserKYC';
import ChangePassword from './ChangePassword';
import { Search, Bell, User, Wallet, Loader2, CheckCircle2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { Outlet, useLocation } from 'react-router-dom';

interface UserPanelProps {
  onLogout: () => void;
  userId: string;
}

export default function UserPanel({ onLogout, userId }: UserPanelProps) {
  const location = useLocation();
  const activeTab = location.pathname.split('/').pop() || 'payment';
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('users_profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) throw error;
      setUserProfile(data);

      // Check if we should show welcome dialogue
      if (data.kyc_status === 'verified') {
        const hasSeenWelcome = localStorage.getItem(`welcome_dialog_shown_${userId}`);
        if (!hasSeenWelcome) {
          setShowWelcome(true);
        }
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-emerald-600" size={40} />
      </div>
    );
  }

  // Mandatory Password Change
  if (userProfile?.must_change_password) {
    return <ChangePassword userId={userId} onSuccess={fetchProfile} />;
  }

  // Check if account is suspended
  if (userProfile?.status === 'Suspended') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-rose-600/20 rounded-full blur-[120px]"></div>
        </div>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/5 backdrop-blur-xl border border-white/10 p-12 rounded-[32px] shadow-2xl max-w-md w-full text-center"
        >
          <div className="w-20 h-20 bg-rose-500/20 rounded-2xl flex items-center justify-center mx-auto mb-8">
            <X className="text-rose-500" size={40} />
          </div>
          <h2 className="text-3xl font-black text-white mb-4 tracking-tight">Access Denied</h2>
          <p className="text-slate-400 text-lg mb-10 leading-relaxed">
            You panel blocked by admin. Please contact support for more information.
          </p>
          <button 
            onClick={onLogout}
            className="w-full py-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-bold transition-all border border-white/10"
          >
            Logout from Portal
          </button>
        </motion.div>
      </div>
    );
  }

  // Mandatory KYC Verification
  if (userProfile?.kyc_status !== 'verified') {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-end mb-8">
            <button onClick={onLogout} className="text-slate-400 hover:text-rose-500 font-bold text-sm transition-colors">Logout</button>
          </div>
          <UserKYC userId={userId} onStatusChange={fetchProfile} />
        </div>
      </div>
    );
  }

  const handleCloseWelcome = () => {
    setShowWelcome(false);
    localStorage.setItem(`welcome_dialog_shown_${userId}`, 'true');
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900">
      <AnimatePresence>
        {showWelcome && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[32px] p-8 max-w-lg w-full shadow-2xl border border-emerald-100 relative overflow-hidden"
            >
              {/* Decorative background elements */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16 opacity-50"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-50 rounded-full -ml-12 -mb-12 opacity-50"></div>

              <button 
                onClick={handleCloseWelcome}
                className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
              >
                <X size={20} />
              </button>

              <div className="relative text-center">
                <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 mx-auto mb-6 shadow-inner">
                  <CheckCircle2 size={40} />
                </div>
                
                <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Verification Approved!</h2>
                <p className="text-xl text-emerald-600 font-bold mb-6">Welcome to Rajwadi Portal</p>
                
                <div className="bg-slate-50 rounded-2xl p-6 mb-8 border border-slate-100">
                  <p className="text-slate-600 leading-relaxed">
                    Great news! Your identity and business documents have been verified. Your dashboard is now fully active and ready for use.
                  </p>
                </div>

                <button 
                  onClick={handleCloseWelcome}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold transition-all shadow-xl shadow-emerald-200 active:scale-[0.98]"
                >
                  Get Started
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <UserSidebar onLogout={onLogout} />
      
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search transactions, bills..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-xl">
              <Wallet className="text-emerald-600" size={18} />
              <span className="text-sm font-bold text-emerald-700">₹{(Number(userProfile?.wallet_balance) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <button className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors relative">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="h-8 w-px bg-slate-200 mx-2"></div>
            <div className="flex items-center gap-3 pl-2">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-900 leading-none">{userProfile?.firm_name || userProfile?.name}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {userProfile?.name ? (
                    userProfile.name.split(' ').length > 2 
                      ? `${userProfile.name.split(' ')[0]} ${userProfile.name.split(' ').pop()}` 
                      : userProfile.name
                  ) : ''}
                </p>
              </div>
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 border border-emerald-200 overflow-hidden">
                {userProfile?.profile_photo_url ? (
                  <img src={userProfile.profile_photo_url} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <User size={20} />
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
