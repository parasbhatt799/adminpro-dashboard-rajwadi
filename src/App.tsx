/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import UsersList from './components/UsersList';
import QRManagement from './components/QRManagement';
import BankManagement from './components/BankManagement';
import ServiceChargeManagement from './components/ServiceChargeManagement';
import ReasonManagement from './components/ReasonManagement';
import QRPaymentRequests from './components/QRPaymentRequests';
import BillPaymentRequests from './components/BillPaymentRequests';
import KYCVerificationRequests from './components/KYCVerificationRequests';
import ComplaintsManagement from './components/ComplaintsManagement';
import QRPaymentReport from './components/QRPaymentReport';
import BillPaymentReport from './components/BillPaymentReport';
import PayoutReport from './components/PayoutReport';
import StatementReport from './components/StatementReport';
import DistributorQRReport from './components/DistributorQRReport';
import HeadlineManagement from './components/HeadlineManagement';
import PolicyManagement from './components/PolicyManagement';
import AdminManagement from './components/AdminManagement';
import ChangePassword from './components/ChangePassword';
import Login from './components/Login';
import AgreementManagement from './components/AgreementManagement';
import QRScreenshotGallery from './components/QRScreenshotGallery';
import Settings from './components/Settings';
import AdminWithdrawal from './components/AdminWithdrawal';
import PayoutManagement from './components/PayoutManagement';
import DeveloperLogs from './components/DeveloperLogs';
import UserPanel from './components/user/UserPanel';
import UserPayment from './components/user/UserPayment';
import UserReports from './components/user/UserReports';
import UserComplaints from './components/user/UserComplaints';
import UserPolicies from './components/user/UserPolicies';
import UserStatementReport from './components/user/UserStatementReport';
import UserDashboard from './components/user/UserDashboard';
import UserChangePassword from './components/user/UserChangePassword';
import DistributorUsers from './components/user/DistributorUsers';
import DistributorQRRequests from './components/user/DistributorQRRequests';
import DistributorWithdrawal from './components/user/DistributorWithdrawal';
import DistributorBillPayments from './components/user/DistributorBillPayments';
import DistributorStatementReport from './components/user/DistributorStatementReport';
import AdminDistributorWithdrawals from './components/AdminDistributorWithdrawals';
import DistributorsList from './components/DistributorsList';
import AdminStatementReport from './components/AdminStatementReport.tsx';
import HomePage from './components/HomePage';
import { Search, Bell, User, Menu, MessageSquare, Clock, ShieldCheck, Shield, Trash2, Smartphone } from 'lucide-react';
import { supabase } from './lib/supabase';
import { formatDistanceToNow, parseISO, format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Cog, RefreshCw } from 'lucide-react';
import { useToast } from './context/ToastContext';

const DEVELOPER_MOBILE = '9999099999';
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds

// OneSignal Initialization Helper
const setupOneSignal = async (currentUserId: string) => {
  try {
    const OneSignalDeferred = (window as any).OneSignalDeferred;
    if (!OneSignalDeferred) return;

    // 1. Fetch App ID
    const { data: settings } = await supabase
      .from('onesignal_settings')
      .select('app_id')
      .eq('id', 1)
      .single();

    if (!settings?.app_id) return;

    // 2. Initialize via Deferred Queue
    OneSignalDeferred.push(async (OneSignal: any) => {
      if (OneSignal.initialized) return;

      await OneSignal.init({
        appId: settings.app_id,
        allowLocalhostAsSecureOrigin: true,
        notifyButton: { enable: false },
        serviceWorkerParam: { scope: '/' },
        serviceWorkerPath: 'OneSignalSDKWorker.js',
      });

      // 3. Sync ID or Cleanup if logged out
      const pushId = OneSignal.User.PushSubscription?.id;

      if (currentUserId) {
        // Always associate this device with the user's ID in OneSignal
        OneSignal.login(currentUserId);

        if (pushId) {
          // 1. Clear this pushId from any other users to ensure uniqueness
          // This prevents notification leaks if multiple users share a device
          await supabase
            .from('users_profiles')
            .update({ onesignal_id: null })
            .eq('onesignal_id', pushId);

          const userType = localStorage.getItem('userType');

          if (userType === 'admin') {
            // Admins: Sync to users_profiles with 'admin' role so backend can find them
            await supabase
              .from('users_profiles')
              .upsert({
                id: currentUserId,
                onesignal_id: pushId,
                role: 'admin'
              }, { onConflict: 'id' });
            console.log('OneSignal Admin Sync Success:', pushId);
          } else {
            // Regular Users: Sync to their existing profile and ensure role is 'user'
            await supabase
              .from('users_profiles')
              .update({
                onesignal_id: pushId,
                role: 'user'
              })
              .eq('id', currentUserId);
            console.log('OneSignal User Sync Success:', pushId);
          }
        }
      } else if (pushId) {
        // Logged out: Aggressively clear this device from any user profiles in our DB
        await supabase
          .from('users_profiles')
          .update({ onesignal_id: null })
          .eq('onesignal_id', pushId);

        // Also tell OneSignal to logout
        OneSignal.logout();
        console.log('OneSignal Cleaned (Logged Out):', pushId);
      }
    });

  } catch (err) {
    console.error('OneSignal Setup Error:', err);
  }
};


// --- Layout Components ---

const PageUnderConstruction = ({ tab }: { tab: string }) => (
  <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
      <Search size={32} />
    </div>
    <h3 className="text-xl font-semibold text-slate-600">Page Under Construction</h3>
    <p className="mt-2 text-center max-w-xs">
      The <span className="font-bold text-indigo-600 capitalize">{tab.replace('-', ' ')}</span> page is currently being designed and will be available soon.
    </p>
  </div>
);

const MaintenanceOverlay = ({ message }: { message: string }) => (
  <div className="fixed inset-0 z-[9999] bg-slate-900 flex items-center justify-center p-6 overflow-hidden">
    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-md w-full bg-white rounded-[40px] p-10 text-center shadow-2xl relative z-10"
    >
      <div className="w-24 h-24 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner border border-rose-100">
        <AlertTriangle size={48} className="text-rose-500 animate-pulse" />
      </div>
      <h1 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">System Locked</h1>
      <p className="text-slate-500 text-sm leading-relaxed mb-8">
        {message || "The platform is currently undergoing critical security updates. We will be back online shortly."}
      </p>
      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 mb-8">
        <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
          <RefreshCw size={14} className="animate-spin" />
          Checking System Status...
        </div>
      </div>
      <p className="text-[10px] text-slate-300 font-bold uppercase tracking-[0.2em]">
        Authorized Access Only
      </p>
    </motion.div>
  </div>
);

interface AdminLayoutProps {
  handleLogout: () => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (val: boolean) => void;
  showAdminNotifications: boolean;
  setShowAdminNotifications: (val: boolean) => void;
  unreadAdminCount: number;
  adminNotifications: any[];
  handleDeleteAdminNotification: (e: React.MouseEvent, id: string) => void;
  handleClearAllAdminNotifications: (e: React.MouseEvent) => void;
  fetchAdminNotifications: () => void;
  userId: string;
  adminRole: string;
  totalHoldBalance: number;
  pendingCounts: { qr: number; bill: number; kyc: number; payout: number };
  isDeveloper: boolean;
  adminPermissions: string[];
}

const LiveClock = ({ colorClass = "text-slate-500" }: { colorClass?: string }) => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-end mr-2 select-none">
      <span className={`text-[10px] font-black uppercase tracking-wider ${colorClass} opacity-60 leading-none mb-1`}>
        {format(now, 'dd MMM yyyy')}
      </span>
      <span className={`text-xs font-bold leading-none ${colorClass}`}>
        {format(now, 'hh:mm:ss a')}
      </span>
    </div>
  );
};

const AdminLayout = ({
  handleLogout,
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  showAdminNotifications,
  setShowAdminNotifications,
  unreadAdminCount,
  adminNotifications,
  handleDeleteAdminNotification,
  handleClearAllAdminNotifications,
  fetchAdminNotifications,
  userId,
  adminRole,
  totalHoldBalance,
  pendingCounts,
  isDeveloper,
  adminPermissions
}: AdminLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const currentTab = location.pathname.substring(1) || 'dashboard';

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900">
      <Sidebar
        onLogout={handleLogout}
        isCollapsed={isSidebarCollapsed}
        adminRole={adminRole}
        adminPermissions={adminPermissions}
        pendingCounts={pendingCounts}
        isDeveloper={isDeveloper}
      />

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
            >
              <Menu size={20} />
            </button>
            <div className="relative w-96 font-sans">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search anything..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <LiveClock />

            {/* Total Hold Balance Wallet */}
            <div className="hidden lg:flex items-center gap-2 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-100 shadow-sm animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600 shadow-inner">
                <Shield size={18} className="animate-pulse" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest leading-none mb-0.5">Total Hold</span>
                <span className="text-sm font-bold text-slate-900 leading-none">₹{totalHoldBalance.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</span>
              </div>
            </div>

            <div className="w-px h-8 bg-slate-100 mx-1 hidden lg:block"></div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowAdminNotifications(!showAdminNotifications)}
                className={`p-2 rounded-lg transition-all relative ${showAdminNotifications ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
                  }`}
              >
                <Bell size={20} />
                {unreadAdminCount > 0 && (
                  <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white animate-pulse"></span>
                )}
              </button>

              <AnimatePresence>
                {showAdminNotifications && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowAdminNotifications(false)}
                    ></div>
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-3 w-80 bg-white rounded-3xl shadow-2xl border border-slate-100 z-20 overflow-hidden"
                    >
                      <div className="p-4 border-b border-slate-50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-900">Admin Alerts</h3>
                          {unreadAdminCount > 0 && (
                            <span className="text-[10px] bg-rose-50 text-rose-500 px-2 py-0.5 rounded-full font-black uppercase">
                              {unreadAdminCount} New
                            </span>
                          )}
                        </div>
                        {adminNotifications.length > 0 && (
                          <button
                            type="button"
                            onClick={handleClearAllAdminNotifications}
                            className="text-[10px] font-bold text-rose-500 hover:text-rose-600 uppercase tracking-wider"
                          >
                            Clear All
                          </button>
                        )}
                      </div>
                      <div className="max-h-[400px] overflow-y-auto no-scrollbar">
                        {adminNotifications.length === 0 ? (
                          <div className="p-8 text-center">
                            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mx-auto mb-3">
                              <Bell size={20} />
                            </div>
                            <p className="text-xs text-slate-400 font-medium">No alerts yet</p>
                          </div>
                        ) : (
                          adminNotifications.map((n) => (
                            <div
                              key={n.id}
                              onClick={async () => {
                                // Mark as read
                                if (!n.is_read) {
                                  await supabase
                                    .from('notifications')
                                    .update({ is_read: true })
                                    .eq('id', n.id);
                                  fetchAdminNotifications();
                                }
                                setShowAdminNotifications(false);
                                navigate(n.link || '/');
                              }}
                              className={`p-4 border-b border-slate-50 last:border-0 cursor-pointer transition-colors hover:bg-slate-50 relative group ${!n.is_read ? 'bg-indigo-50/30' : ''}`}
                            >
                              {!n.is_read && (
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500"></div>
                              )}
                              <div className="flex gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${!n.is_read ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                                  {n.title.toLowerCase().includes('kyc') ? <ShieldCheck size={14} /> : <MessageSquare size={14} />}
                                </div>
                                <div className="flex-1">
                                  <p className={`text-xs ${!n.is_read ? 'font-bold text-slate-900' : 'font-medium text-slate-600'}`}>
                                    {n.title}
                                  </p>
                                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                                  <div className="flex items-center justify-between mt-2">
                                    <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                                      <Clock size={10} />
                                      {formatDistanceToNow(parseISO(n.created_at), { addSuffix: true })}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={(e) => handleDeleteAdminNotification(e, n.id)}
                                      className="p-1 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            <div className="h-8 w-px bg-slate-200 mx-2"></div>
            <div className="flex items-center gap-3 pl-2">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-900 leading-none">{userId}</p>
                <p className="text-xs text-slate-500 mt-1 capitalize">{adminRole} Admin</p>
              </div>
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 border border-indigo-200">
                <User size={20} />
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
};

// --- Main App Component ---

export default function App() {
  const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem('userType') === 'admin');
  const [soundSettings, setSoundSettings] = useState<any>(null);
  const soundSettingsRef = useRef<any>(null);

  useEffect(() => {
    soundSettingsRef.current = soundSettings;
  }, [soundSettings]);

  // Fetch Sound Settings
  const fetchSoundSettings = async () => {
    try {
      const { data } = await supabase
        .from('qr_settings')
        .select('*')
        .eq('id', 1)
        .single();
      if (data) {
        setSoundSettings(data);
        soundSettingsRef.current = data;
      }
    } catch (err) {
      console.error('Error fetching sound settings:', err);
    }
  };

  const [isUser, setIsUser] = useState(() => localStorage.getItem('userType') === 'user');
  const [userId, setUserId] = useState(() => localStorage.getItem('userId') || '');
  const [adminRole, setAdminRole] = useState(() => localStorage.getItem('adminRole') || 'full');
  const [adminPermissions, setAdminPermissions] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('adminPermissions') || '[]');
    } catch {
      return [];
    }
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSystemEnabled, setIsSystemEnabled] = useState(true);
  const [isUserPanelEnabled, setIsUserPanelEnabled] = useState(true);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [isStatusLoading, setIsStatusLoading] = useState(true);

  const isDeveloper = userId === DEVELOPER_MOBILE;

  useEffect(() => {
    if ((window as any).OneSignal) {
      setupOneSignal(userId);
    }
  }, [userId]);

  const fetchSystemStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('system_status')
        .select('*')
        .eq('id', 1)
        .single();

      if (!error && data) {
        setIsSystemEnabled(data.is_enabled);
        setIsUserPanelEnabled(data.is_user_panel_enabled ?? true);
        setMaintenanceMessage(data.message);
      }
    } catch (err) {
      console.error('Error fetching system status:', err);
    } finally {
      setIsStatusLoading(false);
    }
  };

  useEffect(() => {
    // Timeout fallback: if Supabase is unreachable, don't block on the loading spinner
    const fallbackTimer = setTimeout(() => {
      setIsStatusLoading(false);
    }, 6000);
    fetchSystemStatus().finally(() => clearTimeout(fallbackTimer));

    // Fetch and set initial branding and sound settings
    const fetchInitialSettings = async () => {
      const { data } = await supabase.from('qr_settings').select('*').eq('id', 1).single();
      if (data) {
        if (data.favicon_url) {
          updateFavicon(data.favicon_url);
        }
        setSoundSettings(data);
        soundSettingsRef.current = data;
      }
    };
    fetchInitialSettings();

    // Global Settings Listener
    const settingsChannel = supabase.channel('global_settings')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'qr_settings', filter: 'id=eq.1' }, (payload) => {
        if (payload.new) {
          if (payload.new.favicon_url) {
            updateFavicon(payload.new.favicon_url);
          }
          setSoundSettings(payload.new);
          soundSettingsRef.current = payload.new;
        }
      })
      .subscribe();

    // Subscribe to system status changes
    const channel = supabase
      .channel('system_status_realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'system_status' }, (payload) => {
        setIsSystemEnabled(payload.new.is_enabled);
        setIsUserPanelEnabled(payload.new.is_user_panel_enabled ?? true);
        setMaintenanceMessage(payload.new.message);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(settingsChannel);
    };
  }, []);

  const updateFavicon = (url: string) => {
    let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.getElementsByTagName('head')[0].appendChild(link);
    }
    link.href = url;
  };

  // Admin Notification States
  const [adminNotifications, setAdminNotifications] = useState<any[]>([]);
  const [unreadAdminCount, setUnreadAdminCount] = useState(0);
  const [showAdminNotifications, setShowAdminNotifications] = useState(false);
  const [totalHoldBalance, setTotalHoldBalance] = useState(0);
  const [pendingCounts, setPendingCounts] = useState({ qr: 0, bill: 0, kyc: 0, payout: 0 });

  const fetchPendingCounts = async () => {
    try {
      const [qrRes, billRes, kycRes, payoutRes] = await Promise.all([
        supabase.from('payment_submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('bill_submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('kyc_submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('payout_submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending')
      ]);

      setPendingCounts({
        qr: qrRes.count || 0,
        bill: billRes.count || 0,
        kyc: kycRes.count || 0,
        payout: payoutRes.count || 0
      });
    } catch (err) {
      console.error('Error fetching pending counts:', err);
    }
  };

  const fetchTotalHoldBalance = async () => {
    try {
      const { data, error } = await supabase
        .from('users_profiles')
        .select('hold_balance');

      if (error) throw error;

      const total = (data || []).reduce((sum, u) => sum + (Number(u.hold_balance) || 0), 0);
      setTotalHoldBalance(total);
    } catch (err) {
      console.error('Error fetching total hold balance:', err);
    }
  };

  const fetchAdminNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('target_role', 'admin')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching admin notifications:', error);
        setAdminNotifications([]);
        return;
      }

      setAdminNotifications(data || []);
      setUnreadAdminCount(data?.filter(n => !n.is_read).length || 0);
    } catch (err) {
      console.error('Unexpected error fetching admin notifications:', err);
    }
  };

  const handleDeleteAdminNotification = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setAdminNotifications(prev => prev.filter(n => n.id !== id));
      setUnreadAdminCount(prev => prev - (adminNotifications.find(n => n.id === id)?.is_read ? 0 : 1));
    } catch (err) {
      console.error('Error deleting admin notification:', err);
    }
  };

  const handleClearAllAdminNotifications = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('target_role', 'admin');
      if (error) throw error;
      setAdminNotifications([]);
      setUnreadAdminCount(0);
    } catch (err) {
      console.error('Error clearing all admin notifications:', err);
    }
  };

  useEffect(() => {
    if (isAdmin && userId) {
      fetchAdminNotifications();
      fetchTotalHoldBalance();
      fetchPendingCounts();

      // Helper to play sound
      const playNotificationSound = (type: 'qr' | 'bill' | 'kyc' | 'payout') => {
        const settings = soundSettingsRef.current;
        if (!settings) return;

        const isEnabled = settings[`is_${type}_sound_enabled`] ?? true;
        const defaultSounds: Record<string, string> = {
          qr: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
          bill: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
          kyc: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
          payout: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'
        };

        const soundUrl = settings[`${type}_sound_url`] || defaultSounds[type];

        if (isEnabled && soundUrl) {
          const audio = new Audio(soundUrl);
          audio.play().catch(() => { });
        }
      };

      // Real-time Pending Counts Listeners
      const qrSub = supabase
        .channel('qr_pending_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_submissions' }, (payload) => {
          fetchPendingCounts();
          if (payload.eventType === 'INSERT') {
            playNotificationSound('qr');
          }
        })
        .subscribe();

      const billSub = supabase
        .channel('bill_pending_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bill_submissions' }, (payload) => {
          fetchPendingCounts();
          if (payload.eventType === 'INSERT') {
            playNotificationSound('bill');
          }
        })
        .subscribe();

      const kycSub = supabase
        .channel('kyc_pending_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'kyc_submissions' }, (payload) => {
          fetchPendingCounts();
          if (payload.eventType === 'INSERT') {
            playNotificationSound('kyc');
          }
        })
        .subscribe();

      const payoutSub = supabase
        .channel('payout_pending_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'payout_submissions' }, (payload) => {
          fetchPendingCounts();
          if (payload.eventType === 'INSERT') {
            playNotificationSound('payout');
          }
        })
        .subscribe();

      // Settings are now handled by global listener

      // Hold Balance Listener
      const holdChannel = supabase
        .channel('admin_hold_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'users_profiles' }, () => {
          fetchTotalHoldBalance();
        })
        .subscribe();

      // Notification Listener
      const notifChannel = supabase
        .channel('admin_notifications_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, (payload: any) => {
          const notification = payload.new;
          if (notification && (notification.target_role === 'admin' || !notification.user_id)) {
            fetchAdminNotifications();
          }
        })
        .subscribe();

      // Security & Session Listener
      const securityChannel = supabase
        .channel(`admin_security_${userId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'admin_profiles',
          filter: `mobile_number=eq.${userId}`
        }, (payload) => {
          const { status, role, password, permissions } = payload.new;
          if (status === 'Blocked' || (role && role !== adminRole) || password) {
            handleLogout();
          }
          if (permissions) {
            setAdminPermissions(permissions);
            localStorage.setItem('adminPermissions', JSON.stringify(permissions));
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(notifChannel);
        supabase.removeChannel(securityChannel);
        supabase.removeChannel(holdChannel);
        supabase.removeChannel(qrSub);
        supabase.removeChannel(billSub);
        supabase.removeChannel(kycSub);
        supabase.removeChannel(payoutSub);
      };
    }
  }, [isAdmin, userId, adminRole]);

  // User Notification Sound logic
  useEffect(() => {
    if (isUser && userId) {
      const playUserSound = (type: 'qr' | 'bill' | 'kyc' | 'payout') => {
        const settings = soundSettingsRef.current;
        if (!settings) return;

        const isEnabled = settings[`is_${type}_sound_enabled`] ?? true;
        const defaultSounds: Record<string, string> = {
          qr: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
          bill: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
          kyc: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
          payout: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'
        };

        const soundUrl = settings[`${type}_sound_url`] || defaultSounds[type];

        if (isEnabled && soundUrl) {
          const audio = new Audio(soundUrl);
          audio.play().catch(() => { });
        }
      };

      const playServiceSound = async (isOn: boolean) => {
        try {
          const { data } = await supabase.from('qr_settings').select('is_service_on_sound_enabled, is_service_off_sound_enabled, service_on_sound_url, service_off_sound_url').eq('id', 1).single();
          if (data) {
            const isEnabled = isOn ? data.is_service_on_sound_enabled : data.is_service_off_sound_enabled;
            if (isEnabled) {
              const soundUrl = isOn 
                ? (data.service_on_sound_url || 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')
                : (data.service_off_sound_url || 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
              const audio = new Audio(soundUrl);
              audio.play().catch(() => { });
            }
          }
        } catch (err) {}
      };

      // Listen for Service Status Changes (is_bill_enabled)
      const serviceSub = supabase
        .channel('user_service_status')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'qr_settings', filter: 'id=eq.1' }, (payload) => {
          if (payload.new) {
            const oldIsEnabled = soundSettingsRef.current?.is_bill_enabled;
            if (oldIsEnabled !== undefined && payload.new.is_bill_enabled !== oldIsEnabled) {
              playServiceSound(payload.new.is_bill_enabled);
            }
          }
        })
        .subscribe();

      const qrSub = supabase
        .channel(`user_qr_status_${userId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'payment_submissions',
          filter: `user_id=eq.${userId}`
        }, (payload) => {
          if (payload.new.status === 'approved' || payload.new.status === 'rejected') {
            playUserSound('qr');
          }
        })
        .subscribe();

      const billSub = supabase
        .channel(`user_bill_status_${userId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'bill_submissions',
          filter: `user_id=eq.${userId}`
        }, (payload) => {
          if (payload.new.status === 'approved' || payload.new.status === 'rejected') {
            playUserSound('bill');
          }
        })
        .subscribe();

      const payoutSub = supabase
        .channel(`user_payout_status_${userId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'payout_submissions',
          filter: `user_id=eq.${userId}`
        }, (payload) => {
          if (payload.new.status === 'approved' || payload.new.status === 'rejected') {
            playUserSound('payout');
          }
        })
        .subscribe();

      const kycSub = supabase
        .channel(`user_kyc_status_${userId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'users_profiles',
          filter: `id=eq.${userId}`
        }, (payload) => {
          if (payload.new.kyc_status === 'verified' || payload.new.kyc_status === 'rejected') {
            playUserSound('kyc');
          }
        })
        .on('postgres_changes', {
          event: 'DELETE',
          schema: 'public',
          table: 'users_profiles',
          filter: `id=eq.${userId}`
        }, () => {
          console.log('User deleted, logging out...');
          handleLogout();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(qrSub);
        supabase.removeChannel(billSub);
        supabase.removeChannel(payoutSub);
        supabase.removeChannel(kycSub);
        supabase.removeChannel(serviceSub);
      };
    }
  }, [isUser, userId]);

  const handleLogin = (id: string, userType: 'admin' | 'user', role?: string, permissions?: string[]) => {
    localStorage.setItem('userId', id);
    localStorage.setItem('userType', userType);
    if (role) localStorage.setItem('adminRole', role);
    if (permissions) localStorage.setItem('adminPermissions', JSON.stringify(permissions));

    if (userType === 'admin') {
      setIsAdmin(true);
      setIsUser(false);
      setAdminRole(role || 'full');
      setAdminPermissions(permissions || []);
    } else {
      setIsUser(true);
      setIsAdmin(false);
    }
    setUserId(id);
  };

  const handleLogout = async () => {
    // 1. Clear OneSignal association in DB (best-effort, don't block logout)
    if (userId) {
      try {
        await supabase
          .from('users_profiles')
          .update({ onesignal_id: null })
          .eq('id', userId);
      } catch (err) {
        console.warn('OneSignal DB clear failed (non-blocking):', err);
      }
    }

    // 2. OneSignal Logout to clear association in their system
    const OneSignalDeferred = (window as any).OneSignalDeferred;
    if (OneSignalDeferred) {
      OneSignalDeferred.push((OneSignal: any) => {
        OneSignal.logout();
      });
    }

    localStorage.removeItem('userId');
    localStorage.removeItem('userType');
    localStorage.removeItem('adminRole');
    localStorage.removeItem('adminPermissions');
    setIsAdmin(false);
    setIsUser(false);
    setUserId('');
    setAdminRole('full');
    setAdminPermissions([]);
  };

  // Session Inactivity Timeout Logic
  const toast = useToast();
  useEffect(() => {
    if (!isAdmin && !isUser) return;

    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        console.log('Session expired due to inactivity');
        toast.warning('Session expired due to 30 minutes of inactivity. Please login again.', 10000);
        handleLogout();
      }, INACTIVITY_TIMEOUT);
    };

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    
    // Add event listeners
    activityEvents.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    // Initial timer start
    resetTimer();

    return () => {
      // Cleanup
      if (timeoutId) clearTimeout(timeoutId);
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [isAdmin, isUser, userId]);

  if (isStatusLoading) {
    return (
      <div className="h-screen w-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Waking up secure kernels...</p>
        </div>
      </div>
    );
  }

  if (!isSystemEnabled && !isDeveloper) {
    return <MaintenanceOverlay message={maintenanceMessage} />;
  }

  if (isUser && !isUserPanelEnabled) {
    return <MaintenanceOverlay message={maintenanceMessage || "The user panel is currently under maintenance. Please try again later."} />;
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage isAdmin={isAdmin} isUser={isUser} onLogout={handleLogout} />} />
        <Route
          element={
            !isAdmin ? <Navigate to="/login" replace /> :
              <AdminLayout
                handleLogout={handleLogout}
                isSidebarCollapsed={isSidebarCollapsed}
                setIsSidebarCollapsed={setIsSidebarCollapsed}
                showAdminNotifications={showAdminNotifications}
                setShowAdminNotifications={setShowAdminNotifications}
                unreadAdminCount={unreadAdminCount}
                adminNotifications={adminNotifications}
                handleDeleteAdminNotification={handleDeleteAdminNotification}
                handleClearAllAdminNotifications={handleClearAllAdminNotifications}
                fetchAdminNotifications={fetchAdminNotifications}
                userId={userId}
                adminRole={adminRole}
                totalHoldBalance={totalHoldBalance}
                pendingCounts={pendingCounts}
                isDeveloper={isDeveloper}
                adminPermissions={adminPermissions}
              />
          }
        >
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="change-password" element={<ChangePassword adminId={userId} adminRole={adminRole} onLogout={handleLogout} />} />

          {/* Permission-Checked Routes */}
          <Route path="users-list" element={(adminRole === 'full' || adminPermissions.includes('users-list')) ? <UsersList adminRole={adminRole} /> : <Navigate to="/dashboard" replace />} />
          <Route path="distributors" element={(adminRole === 'full' || adminPermissions.includes('distributors')) ? <DistributorsList /> : <Navigate to="/dashboard" replace />} />
          <Route path="distributor-withdrawals" element={(adminRole === 'full' || adminPermissions.includes('distributor-withdrawals')) ? <AdminDistributorWithdrawals /> : <Navigate to="/dashboard" replace />} />
          <Route path="service-charge" element={(adminRole === 'full' || adminPermissions.includes('service-charge')) ? <ServiceChargeManagement adminRole={adminRole} /> : <Navigate to="/dashboard" replace />} />
          <Route path="qr-payment-requests" element={(adminRole === 'full' || adminPermissions.includes('qr-payment-requests')) ? <QRPaymentRequests /> : <Navigate to="/dashboard" replace />} />
          <Route path="bill-payment-requests" element={(adminRole === 'full' || adminPermissions.includes('bill-payment-requests')) ? <BillPaymentRequests /> : <Navigate to="/dashboard" replace />} />
          <Route path="payout-requests" element={(adminRole === 'full' || adminPermissions.includes('payout-requests')) ? <PayoutManagement /> : <Navigate to="/dashboard" replace />} />
          <Route path="reason-entry" element={(adminRole === 'full' || adminPermissions.includes('reason-entry')) ? <ReasonManagement /> : <Navigate to="/dashboard" replace />} />
          <Route path="complaints-management" element={(adminRole === 'full' || adminPermissions.includes('complaints-management')) ? <ComplaintsManagement /> : <Navigate to="/dashboard" replace />} />
          <Route path="headlines" element={(adminRole === 'full' || adminPermissions.includes('headlines')) ? <HeadlineManagement /> : <Navigate to="/dashboard" replace />} />
          <Route path="policies" element={(adminRole === 'full' || adminPermissions.includes('policies')) ? <PolicyManagement /> : <Navigate to="/dashboard" replace />} />
          <Route path="agreement" element={(adminRole === 'full' || adminPermissions.includes('user-agreement')) ? <AgreementManagement /> : <Navigate to="/dashboard" replace />} />
          <Route path="bank-upload" element={(adminRole === 'full' || adminPermissions.includes('bank-upload')) ? <BankManagement /> : <Navigate to="/dashboard" replace />} />
          <Route path="withdrawal-balance" element={(adminRole === 'full' || adminPermissions.includes('withdrawal-balance')) ? <AdminWithdrawal /> : <Navigate to="/dashboard" replace />} />
          <Route path="qr-upload" element={(adminRole === 'full' || adminPermissions.includes('qr-upload')) ? <QRManagement /> : <Navigate to="/dashboard" replace />} />
          <Route path="kyc-verification-requests" element={(adminRole === 'full' || adminPermissions.includes('kyc-verification-requests')) ? <KYCVerificationRequests /> : <Navigate to="/dashboard" replace />} />
          <Route path="qr-gallery" element={(adminRole === 'full' || adminPermissions.includes('qr-gallery')) ? <QRScreenshotGallery /> : <Navigate to="/dashboard" replace />} />
          
          <Route path="reports">
            <Route path="qr-payment" element={(adminRole === 'full' || adminPermissions.includes('report-generate')) ? <QRPaymentReport /> : <Navigate to="/dashboard" replace />} />
            <Route path="bill-payment" element={(adminRole === 'full' || adminPermissions.includes('report-generate')) ? <BillPaymentReport /> : <Navigate to="/dashboard" replace />} />
            <Route path="payout" element={(adminRole === 'full' || adminPermissions.includes('report-generate')) ? <PayoutReport /> : <Navigate to="/dashboard" replace />} />
            <Route path="statement" element={(adminRole === 'full' || adminPermissions.includes('report-generate')) ? <StatementReport /> : <Navigate to="/dashboard" replace />} />
            <Route path="admin-statement" element={(adminRole === 'full' || adminPermissions.includes('report-generate')) ? <AdminStatementReport /> : <Navigate to="/dashboard" replace />} />
            <Route path="distributor-profit" element={(adminRole === 'full' || adminPermissions.includes('report-generate')) ? <DistributorQRReport /> : <Navigate to="/dashboard" replace />} />
          </Route>

          {/* Full Admin Only Routes */}
          {adminRole === 'full' && (
            <>
              <Route path="admin-management" element={<AdminManagement currentAdminId={userId} adminRole={adminRole} onLogout={handleLogout} />} />
              <Route path="settings" element={<Settings />} />
              <Route path="developer-logs" element={<DeveloperLogs />} />
            </>
          )}
        </Route>
        <Route
          path="/user"
          element={!isUser ? <Navigate to="/login" replace /> : <UserPanel onLogout={handleLogout} userId={userId} />}
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<UserDashboard userId={userId} />} />
          <Route path="payment" element={<UserPayment userId={userId} />} />
          <Route path="reports" element={<UserReports userId={userId} />} />
          <Route path="statement" element={<UserStatementReport userId={userId} />} />
          <Route path="my-users" element={<DistributorUsers userId={userId} />} />
          <Route path="users-qr-requests" element={<DistributorQRRequests userId={userId} />} />
          <Route path="users-bill-payments" element={<DistributorBillPayments userId={userId} />} />
          <Route path="users-statement" element={<DistributorStatementReport userId={userId} />} />
          <Route path="withdrawal" element={<DistributorWithdrawal userId={userId} />} />
          <Route path="complaints" element={<UserComplaints userId={userId} />} />
          <Route path="policies" element={<UserPolicies userId={userId} />} />
          <Route path="change-password" element={<UserChangePassword userId={userId} onLogout={handleLogout} />} />

        </Route>
        <Route
          path="/login"
          element={
            isAdmin ? <Navigate to="/dashboard" replace /> :
              isUser ? <Navigate to="/user/dashboard" replace /> :
                <Login onLogin={handleLogin} />
          }
        />
      </Routes>
    </Router>
  );
}
