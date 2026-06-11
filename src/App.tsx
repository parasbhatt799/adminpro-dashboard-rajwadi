/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import LoadingSpinner from './components/shared/LoadingSpinner';

// --- Lazy Loaded Components ---
const Sidebar = lazy(() => import('./components/Sidebar'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const UsersList = lazy(() => import('./components/UsersList'));
const QRManagement = lazy(() => import('./components/QRManagement'));
const QRHistoryTracking = lazy(() => import('./components/QRHistoryTracking'));
const BankManagement = lazy(() => import('./components/BankManagement'));
const ServiceChargeManagement = lazy(() => import('./components/ServiceChargeManagement'));
const ReasonManagement = lazy(() => import('./components/ReasonManagement'));
const QRPaymentRequests = lazy(() => import('./components/QRPaymentRequests'));
const BillPaymentRequests = lazy(() => import('./components/BillPaymentRequests'));
const KYCVerificationRequests = lazy(() => import('./components/KYCVerificationRequests'));
const ComplaintsManagement = lazy(() => import('./components/ComplaintsManagement'));
const QRPaymentReport = lazy(() => import('./components/QRPaymentReport'));
const BillPaymentReport = lazy(() => import('./components/BillPaymentReport'));
const PayoutReport = lazy(() => import('./components/PayoutReport'));
const StatementReport = lazy(() => import('./components/StatementReport'));
const DistributorQRReport = lazy(() => import('./components/DistributorQRReport'));
const HeadlineManagement = lazy(() => import('./components/HeadlineManagement'));
const PolicyManagement = lazy(() => import('./components/PolicyManagement'));
const AdminManagement = lazy(() => import('./components/AdminManagement'));
const ChangePassword = lazy(() => import('./components/ChangePassword'));
const Login = lazy(() => import('./components/Login'));
const Advertising = lazy(() => import('./components/Advertising'));
const AgreementManagement = lazy(() => import('./components/AgreementManagement'));
const QRScreenshotGallery = lazy(() => import('./components/QRScreenshotGallery'));
const Settings = lazy(() => import('./components/Settings'));
const AdminWithdrawal = lazy(() => import('./components/AdminWithdrawal'));
const PayoutManagement = lazy(() => import('./components/PayoutManagement'));
const DeveloperLogs = lazy(() => import('./components/DeveloperLogs'));
const UserPanel = lazy(() => import('./components/user/UserPanel'));
const UserPayment = lazy(() => import('./components/user/UserPayment'));
const UserBillPayment = lazy(() => import('./components/user/UserBillPayment'));
const UserBillAvenuePayment = lazy(() => import('./components/user/UserBillAvenuePayment'));
const UserBillHistory = lazy(() => import('./components/user/UserBillHistory'));
const UserReports = lazy(() => import('./components/user/UserReports'));
const UserComplaints = lazy(() => import('./components/user/UserComplaints'));
const UserBBPSComplaints = lazy(() => import('./components/user/UserBBPSComplaints'));
const UserPolicies = lazy(() => import('./components/user/UserPolicies'));
const UserStatementReport = lazy(() => import('./components/user/UserStatementReport'));
const UserFundTransfer = lazy(() => import('./components/user/UserFundTransfer'));
const PartnerFundTransfer = lazy(() => import('./components/user/PartnerFundTransfer'));
const UserDashboard = lazy(() => import('./components/user/UserDashboard'));
const UserChangePassword = lazy(() => import('./components/user/UserChangePassword'));
const UserTPIN = lazy(() => import('./components/user/UserTPIN'));
const DistributorUsers = lazy(() => import('./components/user/DistributorUsers'));
const DistributorQRRequests = lazy(() => import('./components/user/DistributorQRRequests'));
const DistributorWithdrawal = lazy(() => import('./components/user/DistributorWithdrawal'));
const DistributorBillPayments = lazy(() => import('./components/user/DistributorBillPayments'));
const DistributorStatementReport = lazy(() => import('./components/user/DistributorStatementReport'));
const QRDistributorReport = lazy(() => import('./components/user/QRDistributorReport'));
const BillDistributorReport = lazy(() => import('./components/user/BillDistributorReport'));
const SuperDistributorWithdrawals = lazy(() => import('./components/user/SuperDistributorWithdrawals'));
const AdminDistributorWithdrawals = lazy(() => import('./components/AdminDistributorWithdrawals'));
const DistributorsList = lazy(() => import('./components/DistributorsList'));
const SuperDistributorsList = lazy(() => import('./components/SuperDistributorsList'));
const AdminStatementReport = lazy(() => import('./components/AdminStatementReport.tsx'));
const QRMasterManagement = lazy(() => import('./components/QRMasterManagement'));
const HomePage = lazy(() => import('./components/HomePage'));
const BBPSHistory = lazy(() => import('./components/BBPSHistory'));
const RechargeDashboard = lazy(() => import('./components/RechargeDashboard'));
const UserRecharge = lazy(() => import('./components/user/UserRecharge'));
import { Search, Bell, User, Menu, MessageSquare, Clock, ShieldCheck, Shield, Trash2, Smartphone, BellOff, CheckCircle2 } from 'lucide-react';
import { supabase, addDevicePushId, removeDevicePushId } from './lib/supabase';
import { formatDistanceToNow, parseISO, format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Cog, RefreshCw } from 'lucide-react';
import { useToast } from './context/ToastContext';
import { PrivacyPolicy, TermsAndConditions, RefundPolicy, CancellationPolicy } from './components/public/Policies';

const DEVELOPER_MOBILE = '9999099999';
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds

const logInit = (msg: string) => {
  console.log('[OneSignalInit]', msg);
  if (typeof window !== 'undefined') {
    (window as any).oneSignalInitLogs = (window as any).oneSignalInitLogs || [];
    (window as any).oneSignalInitLogs.push(msg);
  }
};

// OneSignal Initialization Helper
const initOneSignal = async () => {
  logInit('initOneSignal started');
  try {
    const OneSignalDeferred = (window as any).OneSignalDeferred;
    if (!OneSignalDeferred) {
      logInit('initOneSignal: OneSignalDeferred missing on window');
      return;
    }

    let appId = '0b006a43-d6bf-4087-81d6-86c69fec876d'; // Hardcoded default fallback
    logInit('initOneSignal: Fetching app ID from DB with 2s timeout...');

    try {
      const dbPromise = supabase
        .from('onesignal_settings')
        .select('app_id')
        .eq('id', 1)
        .single();
      
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000));
      const result = await Promise.race([dbPromise, timeoutPromise]);

      if (result && 'data' in result && result.data?.app_id) {
        appId = result.data.app_id;
        logInit('initOneSignal: Fetched App ID from DB: ' + appId);
      } else if (result === null) {
        logInit('initOneSignal: DB fetch timed out. Using fallback App ID: ' + appId);
      } else {
        logInit('initOneSignal: DB fetch empty/error. Using fallback App ID: ' + appId);
      }
    } catch (dbErr: any) {
      logInit('initOneSignal: DB fetch failed: ' + dbErr.message + '. Using fallback App ID: ' + appId);
    }

    logInit('initOneSignal: Pushing initialization task to OneSignalDeferred queue...');
    OneSignalDeferred.push(async (OneSignal: any) => {
      logInit('initOneSignal (Deferred callback): Started execution');
      try {
        logInit(`initOneSignal (Deferred callback): SDK version=${OneSignal.sdk || 'unknown'}, initialized=${OneSignal.initialized || 'false'}`);
        if (!OneSignal.initialized) {
          logInit('initOneSignal (Deferred callback): Calling OneSignal.init...');
          await OneSignal.init({
            appId: appId,
            allowLocalhostAsSecureOrigin: true,
            notifyButton: { enable: false },
            serviceWorkerParam: { scope: '/' },
            serviceWorkerPath: 'OneSignalSDKWorker.js',
          });
          logInit('initOneSignal (Deferred callback): OneSignal.init execution finished');
        } else {
          logInit('initOneSignal (Deferred callback): OneSignal was already initialized');
        }

        // Force foreground notifications to display (show popups even if the tab is focused)
        if (OneSignal.Notifications) {
          logInit('initOneSignal: Notifications namespace exists. Attaching listener...');
          if (!(OneSignal.Notifications as any)._hasForegroundListener) {
            OneSignal.Notifications.addEventListener('foregroundWillDisplay', (event: any) => {
              try {
                if (event.notification) {
                  event.preventDefault(); // Stop default display behavior to prevent double notifications
                  if (typeof event.notification.display === 'function') {
                    event.notification.display();
                    logInit('Foreground notification displayed successfully');
                  }
                }
              } catch (fgErr: any) {
                logInit('Error displaying foreground notification: ' + fgErr.message);
              }
            });
            (OneSignal.Notifications as any)._hasForegroundListener = true;
          }
        } else {
          logInit('initOneSignal: Notifications namespace missing on OneSignal');
        }

        const registerListener = () => {
          if (OneSignal.User?.PushSubscription) {
            // Prevent multiple registrations of the same sync listener
            if ((OneSignal.User.PushSubscription as any)._hasSyncListener) {
              return true;
            }

            OneSignal.User.PushSubscription.addEventListener("change", async (event: any) => {
              try {
                const newPushId = event.current?.id;
                const currentUserId = localStorage.getItem('userId');
                logInit('OneSignal subscription change event. New ID: ' + newPushId);

                if (currentUserId && newPushId) {
                  const userType = localStorage.getItem('userType') as 'admin' | 'user';
                  await addDevicePushId(currentUserId, userType, newPushId);
                  logInit('OneSignal Event Sync Success: ' + newPushId);
                }
              } catch (eventErr: any) {
                logInit('Error handling subscription change event: ' + eventErr.message);
              }
            });

            (OneSignal.User.PushSubscription as any)._hasSyncListener = true;
            logInit('OneSignal subscription change listener registered successfully');
            return true;
          }
          return false;
        };

        // Attempt immediate listener registration. If modules aren't ready, retry for a few seconds.
        if (!registerListener()) {
          logInit('OneSignal User PushSubscription namespace not ready. Scheduling retry polling...');
          let retries = 0;
          const maxRetries = 10;
          const interval = setInterval(() => {
            retries++;
            logInit(`PushSubscription retry attempt ${retries}...`);
            if (registerListener() || retries >= maxRetries) {
              clearInterval(interval);
            }
          }, 1000);
        }

        // Force sync current user immediately after initialization is complete
        const currentUserId = localStorage.getItem('userId');
        if (currentUserId) {
          logInit('Logging in user ' + currentUserId + ' to OneSignal...');
          OneSignal.login(currentUserId);
          const pushId = OneSignal.User?.PushSubscription?.id;
          if (pushId) {
            const userType = localStorage.getItem('userType') as 'admin' | 'user';
            await addDevicePushId(currentUserId, userType, pushId);
            logInit('OneSignal Initialized Sync success: ' + pushId);
          }
        }
      } catch (innerErr: any) {
        logInit('Error inside OneSignalDeferred initialization callback: ' + innerErr.message);
      }
    });

  } catch (err: any) {
    logInit('OneSignal Setup Error: ' + err.message);
  }
};

const syncOneSignalUser = async (currentUserId: string) => {
  try {
    const OneSignalDeferred = (window as any).OneSignalDeferred;
    if (!OneSignalDeferred) return;

    OneSignalDeferred.push(async (OneSignal: any) => {
      try {
        if (currentUserId) {
          // Always associate this device with the user's ID in OneSignal
          OneSignal.login(currentUserId);

          // Auto-prompt on site load/login for admins if permission is 'default'
          const userType = localStorage.getItem('userType') as 'admin' | 'user';
          if (userType === 'admin' && OneSignal.Notifications) {
            const perm = OneSignal.Notifications.permission;
            if (perm === 'default') {
              console.log('Auto-requesting notification permission on load for admin...');
              try {
                await OneSignal.Notifications.requestPermission();
              } catch (permErr) {
                console.error('Error auto-requesting permission:', permErr);
              }
            }
          }

          let attempts = 0;
          const maxAttempts = 10;
          const intervalTime = 2000;

          const checkAndSync = async () => {
            try {
              const pushId = OneSignal.User?.PushSubscription?.id;
              if (pushId) {
                const userType = localStorage.getItem('userType') as 'admin' | 'user';
                await addDevicePushId(currentUserId, userType, pushId);
                console.log('OneSignal Sync Success (User changed):', pushId);
              } else if (attempts < maxAttempts) {
                attempts++;
                setTimeout(checkAndSync, intervalTime);
              } else {
                console.log('OneSignal Sync: Push Subscription ID not resolved after attempts.');
              }
            } catch (syncErr) {
              console.error('OneSignal checkAndSync error:', syncErr);
            }
          };

          await checkAndSync();
        } else {
          // Logged out
          try {
            const pushId = OneSignal.User?.PushSubscription?.id;
            const userType = localStorage.getItem('userType') as 'admin' | 'user';
            if (pushId && userType) {
              await removeDevicePushId(currentUserId, userType, pushId);
            }
            if (OneSignal.User?.externalId && typeof OneSignal.logout === 'function') {
              await OneSignal.logout();
              console.log('OneSignal Cleaned (Logged Out)');
            }
          } catch (logoutErr) {
            console.warn('OneSignal logout skipped/failed:', logoutErr);
          }
        }
      } catch (innerSyncErr) {
        console.error('Error inside OneSignalDeferred sync queue:', innerSyncErr);
      }
    });
  } catch (err) {
    console.error('OneSignal Sync Error:', err);
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
  totalTPlusOneBalance: number;
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
  totalTPlusOneBalance,
  pendingCounts,
  isDeveloper,
  adminPermissions
}: AdminLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const currentTab = location.pathname.substring(1) || 'dashboard';

  const toast = useToast();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permissionState, setPermissionState] = useState('default');
  const [playerId, setPlayerId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [showOneSignalPopover, setShowOneSignalPopover] = useState(false);
  const [isTestingDevice, setIsTestingDevice] = useState(false);
  const [oneSignalDebug, setOneSignalDebug] = useState<string>('Diagnostic logs initialized...');
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone || false;

  const handleTestDeviceNotification = async () => {
    if (!playerId) {
      toast.error('No Player ID found. Please subscribe first.');
      return;
    }
    setIsTestingDevice(true);
    setOneSignalDebug(prev => prev + '\nSending test push request for: ' + playerId);
    try {
      const response = await fetch('/api/send-push-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Test Device Alert 🔔',
          message: 'તમારા આ ફોન પર નોટિફિકેશન સફળતાપૂર્વક ચાલુ થઈ ગઈ છે!',
          player_ids: [playerId]
        })
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to send test');
      toast.success('Test alert sent! Check your phone.');
      setOneSignalDebug(prev => prev + '\nTest push response: Success ' + JSON.stringify(resData));
    } catch (err: any) {
      console.error('Test Device Alert Error:', err);
      toast.error('Test failed: ' + err.message);
      setOneSignalDebug(prev => prev + '\nTest push error: ' + err.message);
    } finally {
      setIsTestingDevice(false);
    }
  };

  useEffect(() => {
    const checkStatus = async () => {
      const OneSignalDeferred = (window as any).OneSignalDeferred;
      if (!OneSignalDeferred) {
        setOneSignalDebug(prev => {
          if (!prev.includes('OneSignalDeferred missing')) return prev + '\nOneSignalDeferred missing on window';
          return prev;
        });
        return;
      }

      OneSignalDeferred.push(async (OneSignal: any) => {
        try {
          // Sync init logs to diagnostic console
          const initLogs = (window as any).oneSignalInitLogs || [];
          setOneSignalDebug(prev => {
            let next = prev;
            initLogs.forEach((l: string) => {
              if (!next.includes(l)) {
                next += '\n' + l;
              }
            });
            const str = `\nSDK version: ${OneSignal.sdk || 'unknown'}, initialized: ${OneSignal.initialized || 'false'}`;
            if (!next.includes(str)) next += str;
            return next;
          });

          if (typeof OneSignal.init === 'function') {
            let hasPermission = false;
            let hasSubscription = false;
            let pushId = null;
            let perm = 'default';

            if (OneSignal.Notifications) {
              perm = OneSignal.Notifications.permission;
              hasPermission = perm === 'granted';
            }
            
            setPermissionState(perm || 'default');
            
            if (OneSignal.User?.PushSubscription) {
              pushId = OneSignal.User.PushSubscription.id;
              hasSubscription = !!pushId && OneSignal.User.PushSubscription.optedIn;
              setOneSignalDebug(prev => {
                const str = `\nSubscription: id=${pushId || 'null'}, optedIn=${OneSignal.User.PushSubscription.optedIn}`;
                if (!prev.includes(str)) return prev + str;
                return prev;
              });
            }

            setIsSubscribed(hasPermission && hasSubscription);
            if (pushId) {
              setPlayerId(pushId);
            }
          }
        } catch (err: any) {
          setOneSignalDebug(prev => prev + '\nStatus check error: ' + err.message);
        }
      });
    };

    checkStatus();
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleGlobalSubscribe = async () => {
    setIsSubscribing(true);
    setOneSignalDebug(prev => prev + '\nStarting global subscribe click handler...');
    let OneSignal = (window as any).OneSignal;

    // Explicitly initialize if needed
    if (!OneSignal || !OneSignal.initialized) {
      setOneSignalDebug(prev => prev + '\nSDK not initialized on click. Invoking initOneSignal...');
      await initOneSignal();
      OneSignal = (window as any).OneSignal;
    }
    
    if (OneSignal && OneSignal.Notifications) {
      try {
        const perm = OneSignal.Notifications.permission;
        setOneSignalDebug(prev => prev + '\nDirect permission read: ' + perm);
        if (perm === 'granted') {
          if (OneSignal.User?.PushSubscription) {
            await OneSignal.User.PushSubscription.optIn();
            const pushId = OneSignal.User.PushSubscription.id;
            setOneSignalDebug(prev => prev + '\nOpted in. Push ID: ' + pushId);
            if (userId && pushId) {
              await addDevicePushId(userId, 'admin', pushId);
              toast.success('Successfully subscribed to notifications!');
            }
          }
        } else {
          setOneSignalDebug(prev => prev + '\nCalling requestPermission() directly...');
          await OneSignal.Notifications.requestPermission();
          
          // Recheck permission immediately after prompt response
          const newPerm = OneSignal.Notifications.permission;
          setOneSignalDebug(prev => prev + '\nPermission after request: ' + newPerm);
          if (newPerm === 'granted') {
            if (OneSignal.User?.PushSubscription) {
              await OneSignal.User.PushSubscription.optIn();
              const pushId = OneSignal.User.PushSubscription.id;
              setOneSignalDebug(prev => prev + '\nNew Sub ID: ' + pushId);
              if (userId && pushId) {
                await addDevicePushId(userId, 'admin', pushId);
                toast.success('Successfully subscribed to notifications!');
              }
            }
          }
        }
        setIsSubscribing(false);
        return;
      } catch (err: any) {
        setOneSignalDebug(prev => prev + '\nDirect subscribe error: ' + err.message);
        console.error('Direct subscription error:', err);
      }
    }

    const OneSignalDeferred = (window as any).OneSignalDeferred;
    if (!OneSignalDeferred) {
      toast.error('OneSignal SDK not loaded. Please refresh.');
      setOneSignalDebug(prev => prev + '\nDeferred missing on click.');
      setIsSubscribing(false);
      return;
    }

    setOneSignalDebug(prev => prev + '\nPushing subscription request to Deferred queue...');
    OneSignalDeferred.push(async (OS: any) => {
      try {
        if (OS.Notifications) {
          const perm = OS.Notifications.permission;
          setOneSignalDebug(prev => prev + '\nDeferred read permission: ' + perm);
          if (perm === 'granted') {
            if (OS.User?.PushSubscription) {
              await OS.User.PushSubscription.optIn();
              const pushId = OS.User.PushSubscription.id;
              setOneSignalDebug(prev => prev + '\nDeferred Sync Sub ID: ' + pushId);
              if (userId && pushId) {
                await addDevicePushId(userId, 'admin', pushId);
                toast.success('Successfully subscribed to notifications!');
              }
            }
          } else {
            setOneSignalDebug(prev => prev + '\nDeferred requestPermission()...');
            await OS.Notifications.requestPermission();
            
            // Recheck permission immediately after prompt response
            const newPerm = OS.Notifications.permission;
            setOneSignalDebug(prev => prev + '\nDeferred new permission: ' + newPerm);
            if (newPerm === 'granted') {
              if (OS.User?.PushSubscription) {
                await OS.User.PushSubscription.optIn();
                const pushId = OS.User.PushSubscription.id;
                setOneSignalDebug(prev => prev + '\nDeferred post-perm ID: ' + pushId);
                if (userId && pushId) {
                  await addDevicePushId(userId, 'admin', pushId);
                  toast.success('Successfully subscribed to notifications!');
                }
              }
            }
          }
        } else if (typeof OS.showNativePrompt === 'function') {
          setOneSignalDebug(prev => prev + '\nCalling showNativePrompt() legacy...');
          await OS.showNativePrompt();
        } else {
          toast.warning('OneSignal is still initializing. Please wait.');
          setOneSignalDebug(prev => prev + '\nNotifications namespace missing on Deferred push.');
        }
      } catch (err: any) {
        console.error('Subscription error:', err);
        setOneSignalDebug(prev => prev + '\nDeferred subscription error: ' + err.message);
        toast.error(err.message || 'Failed to subscribe');
      } finally {
        setIsSubscribing(false);
      }
    });
  };

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
          </div>

          <div className="flex items-center gap-4">
            <LiveClock />

            {/* OneSignal Push Subscription Widget */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  if (permissionState === 'default' && !isSubscribed) {
                    handleGlobalSubscribe();
                  } else {
                    setShowOneSignalPopover(!showOneSignalPopover);
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-sm active:scale-95 ${
                  permissionState === 'denied'
                    ? 'bg-rose-50 border-rose-100 text-rose-700 hover:bg-rose-100'
                    : isSubscribed
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100'
                    : 'bg-indigo-50 border-indigo-100 text-indigo-700 hover:bg-indigo-100 animate-pulse'
                }`}
              >
                {permissionState === 'denied' ? (
                  <>
                    <BellOff size={14} className="shrink-0 text-rose-500" />
                    <span className="hidden sm:inline">Alerts Blocked</span>
                  </>
                ) : isSubscribed ? (
                  <>
                    <CheckCircle2 size={14} className="shrink-0 text-emerald-500" />
                    <span className="hidden sm:inline">Alerts Active</span>
                  </>
                ) : (
                  <>
                    <Bell size={14} className="shrink-0 text-indigo-500 animate-bounce" />
                    <span>Enable Alerts</span>
                  </>
                )}
              </button>

              <AnimatePresence>
                {showOneSignalPopover && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowOneSignalPopover(false)}
                    ></div>
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-3 w-80 bg-white rounded-3xl shadow-2xl border border-slate-100 z-20 p-5 overflow-hidden text-left"
                    >
                      <div className="flex items-center gap-3 border-b border-slate-50 pb-3 mb-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                          permissionState === 'denied'
                            ? 'bg-rose-50 text-rose-500'
                            : isSubscribed
                            ? 'bg-emerald-50 text-emerald-500'
                            : 'bg-indigo-50 text-indigo-500'
                        }`}>
                          {permissionState === 'denied' ? <BellOff size={20} /> : <Bell size={20} />}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">
                            {permissionState === 'denied' ? 'Alerts Blocked' : isSubscribed ? 'Alerts Active' : 'Enable Push Alerts'}
                          </h4>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                            Push Notification Status
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {permissionState === 'denied'
                            ? 'આ બ્રાઉઝરમાં નોટિફિકેશન બ્લોક છે. તેથી બિલ અને પેમેન્ટના અવાજ અને મેસેજ નહીં આવે.'
                            : isSubscribed
                            ? 'આ બ્રાઉઝર પરથી તમને KYC, Bill Payment અને QR Payment ની ઓટોમેટિક નોટિફિકેશન્સ અને સાઉન્ડ મળશે.'
                            : 'આ સાઇટ માટે ઓટોમેટિક પુશ એલર્ટ્સ અને સાઉન્ડ ચાલુ કરવા માટે પરમિશન ઓન કરો.'}
                        </p>

                        {/* iOS PWA Setup Warning */}
                        {isIOS && !isPWA && (
                          <div className="p-3 bg-rose-50 rounded-2xl border border-rose-100/50 text-[11px] text-rose-800 space-y-1.5 font-sans">
                            <p className="font-bold text-rose-900">⚠️ iPhone (iOS) સેટઅપ જરૂરી:</p>
                            <p className="leading-relaxed font-medium">iPhone માં સામાન્ય Safari પેજ પર નોટિફિકેશન ચાલુ નથી થતી. આ રીતે ચાલુ કરો:</p>
                            <ol className="list-decimal pl-4 space-y-1.5 font-semibold text-rose-950">
                              <li>Safari બ્રાઉઝરમાં નીચે <b>Share (તીર વાળું)</b> બટન દબાવો.</li>
                              <li>ત્યાં <b>'Add to Home Screen'</b> પર ક્લિક કરો.</li>
                              <li>હોમ સ્ક્રીન પર બનેલી <b>એપ શોર્ટકટ</b> ખોલો અને લોગિન કરો.</li>
                              <li>ત્યાંથી આ સેટિંગ્સ ખોલીને <b>Subscribe Now</b> પર ક્લિક કરો.</li>
                            </ol>
                          </div>
                        )}

                        {permissionState === 'denied' && (
                          <div className="p-3 bg-rose-50 rounded-2xl border border-rose-100/50 text-[11px] text-rose-700 space-y-1.5 font-sans">
                            <p className="font-bold">ખોલવા માટેની ગાઈડ (How to Reset):</p>
                            <ol className="list-decimal pl-4 space-y-1 font-medium">
                              <li>બ્રાઉઝરની ઉપર URL બારની ડાબી બાજુએ લોક (🔒) અથવા સેટિંગ્સ આઇકોન પર ક્લિક કરો.</li>
                              <li>ત્યાં <b>Notifications</b> શોધો અને તેને <b>Allow</b> (ઓન) કરો.</li>
                              <li>પેજ રીફ્રેશ (Reload) કરો.</li>
                            </ol>
                          </div>
                        )}

                        {/* Diagnostic Details Area */}
                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-[10px] space-y-1.5 text-slate-600 font-sans">
                          <div className="flex justify-between"><span>ડિવાઇસ ટાઇપ:</span><span className="font-bold">{isIOS ? 'iPhone (iOS)' : 'Android / PC'}</span></div>
                          <div className="flex justify-between"><span>એપ મોડ:</span><span className="font-bold">{isPWA ? 'PWA Installed' : 'Browser Tab'}</span></div>
                          <div className="flex justify-between"><span>પરમિશન સ્ટેટ્સ:</span><span className="font-bold capitalize">{permissionState || 'default'}</span></div>
                          <div className="flex justify-between"><span>SDK એક્ટિવ:</span><span className="font-bold">{(window as any).OneSignalDeferred ? 'Yes' : 'No'}</span></div>
                          
                          {playerId ? (
                            <div className="pt-1.5 border-t border-slate-200/60 mt-1.5">
                              <span className="block font-bold text-slate-500 text-[9px] uppercase tracking-wider mb-1">Device Player ID (Click to copy):</span>
                              <code className="text-[9px] font-mono break-all select-all block bg-white p-1.5 rounded-lg border border-slate-200 cursor-pointer" onClick={() => {
                                navigator.clipboard.writeText(playerId || '');
                                toast.success('Player ID copied!');
                              }}>{playerId}</code>
                            </div>
                          ) : (
                            <div className="text-rose-600 text-[9px] font-bold pt-1.5 border-t border-slate-200/60 mt-1.5">
                              ⚠️ Player ID રજીસ્ટર નથી થયું. કૃપા કરીને નીચે 'Subscribe Now' બટન દબાવો.
                            </div>
                          )}
                        </div>

                        {/* Test Push Button */}
                        {playerId && (
                          <button
                            type="button"
                            onClick={handleTestDeviceNotification}
                            disabled={isTestingDevice}
                            className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 border border-indigo-100/50"
                          >
                            {isTestingDevice ? 'Sending Test...' : '🔔 Test Push On This Phone'}
                          </button>
                        )}

                        {/* Diagnostics Logs Collapsible */}
                        <details className="mt-2 text-left bg-slate-50 p-2 rounded-xl text-[9px] font-mono text-slate-500 border border-slate-100">
                          <summary className="cursor-pointer font-sans font-bold uppercase text-[9px] text-slate-400 select-none hover:text-slate-600">
                            ⚙️ Diagnostics Logs ({oneSignalDebug.split('\n').length})
                          </summary>
                          <pre className="mt-1.5 whitespace-pre-wrap break-all max-h-32 overflow-y-auto font-mono text-[8px] bg-white p-1.5 rounded-lg border border-slate-200 text-slate-700 leading-normal">
                            {oneSignalDebug}
                          </pre>
                        </details>

                        <div className="flex gap-2 pt-2">
                          {permissionState === 'denied' ? (
                            <button
                              type="button"
                              onClick={() => {
                                handleGlobalSubscribe();
                              }}
                              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
                            >
                              ફરીથી ટ્રાય કરો
                            </button>
                          ) : isSubscribed ? (
                            <button
                              type="button"
                              onClick={async () => {
                                await handleGlobalSubscribe();
                              }}
                              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
                            >
                              Sync Device ID
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                handleGlobalSubscribe();
                              }}
                              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
                            >
                              Subscribe Now
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setShowOneSignalPopover(false)}
                            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all"
                          >
                            બંધ કરો
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

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

            {/* Total T+1 Balance Wallet */}
            <div className="hidden lg:flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100 shadow-sm animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 shadow-inner">
                <Clock size={18} className="animate-pulse" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest leading-none mb-0.5">Total T+1</span>
                <span className="text-sm font-bold text-slate-900 leading-none">₹{totalTPlusOneBalance.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</span>
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
            <Suspense fallback={<LoadingSpinner />}>
              <Outlet />
            </Suspense>
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
    initOneSignal();
  }, []);

  useEffect(() => {
    syncOneSignalUser(userId);
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
  const [totalTPlusOneBalance, setTotalTPlusOneBalance] = useState(0);
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
        .select('hold_balance, t_plus_one_balance');

      if (error) throw error;

      const totalHold = (data || []).reduce((sum, u) => sum + (Number(u.hold_balance) || 0), 0);
      const totalT1 = (data || []).reduce((sum, u) => sum + (Number(u.t_plus_one_balance) || 0), 0);
      setTotalHoldBalance(totalHold);
      setTotalTPlusOneBalance(totalT1);
    } catch (err) {
      console.error('Error fetching total hold and T+1 balance:', err);
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

      const bbpsSub = supabase
        .channel('bbps_pending_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bbps_submissions' }, (payload) => {
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
          const oldPassword = payload.old?.password;
          const passwordChanged = oldPassword && password !== oldPassword;
          if (status === 'Blocked' || (role && role !== adminRole) || passwordChanged) {
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
        supabase.removeChannel(bbpsSub);
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
        const userType = localStorage.getItem('userType') as 'admin' | 'user';
        const OneSignalDeferred = (window as any).OneSignalDeferred;
        let pushId: string | null = null;
        if (OneSignalDeferred) {
          await new Promise<void>((resolve) => {
            OneSignalDeferred.push((OneSignal: any) => {
              pushId = OneSignal.User?.PushSubscription?.id || null;
              resolve();
            });
          });
        }
        if (pushId) {
          await removeDevicePushId(userId, userType, pushId);
        }
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
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
        <Route path="/refund-policy" element={<RefundPolicy />} />
        <Route path="/cancellation-policy" element={<CancellationPolicy />} />
        <Route
          element={
            !isAdmin ? <Navigate to="/admin-login" replace /> :
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
                totalTPlusOneBalance={totalTPlusOneBalance}
                pendingCounts={pendingCounts}
                isDeveloper={isDeveloper}
                adminPermissions={adminPermissions}
              />
          }
        >
          <Route path="dashboard" element={
            (adminRole === 'full' || adminPermissions.includes('dashboard')) ? <Dashboard /> :
            adminPermissions.includes('users-list') ? <Navigate to="/users-list" replace /> :
            adminPermissions.includes('qr-payment-requests') ? <Navigate to="/qr-payment-requests" replace /> :
            adminPermissions.includes('bill-payment-requests') ? <Navigate to="/bill-payment-requests" replace /> :
            adminPermissions.includes('payout-requests') ? <Navigate to="/payout-requests" replace /> :
            adminPermissions.includes('qr-upload') ? <Navigate to="/qr-upload" replace /> :
            adminPermissions.includes('qr-history') ? <Navigate to="/qr-history" replace /> :
            adminPermissions.includes('super-distributors') ? <Navigate to="/super-distributors" replace /> :
            adminPermissions.includes('distributors') ? <Navigate to="/distributors" replace /> :
            adminPermissions.includes('distributor-withdrawals') ? <Navigate to="/distributor-withdrawals" replace /> :
            adminPermissions.includes('service-charge') ? <Navigate to="/service-charge" replace /> :
            adminPermissions.includes('reason-entry') ? <Navigate to="/reason-entry" replace /> :
            adminPermissions.includes('complaints-management') ? <Navigate to="/complaints-management" replace /> :
            adminPermissions.includes('headlines') ? <Navigate to="/headlines" replace /> :
            adminPermissions.includes('policies') ? <Navigate to="/policies" replace /> :
            adminPermissions.includes('user-agreement') ? <Navigate to="/agreement" replace /> :
            adminPermissions.includes('bank-upload') ? <Navigate to="/bank-upload" replace /> :
            adminPermissions.includes('withdrawal-balance') ? <Navigate to="/withdrawal-balance" replace /> :
            adminPermissions.includes('qr-master') ? <Navigate to="/qr-master" replace /> :
            adminPermissions.includes('kyc-verification-requests') ? <Navigate to="/kyc-verification-requests" replace /> :
            adminPermissions.includes('qr-gallery') ? <Navigate to="/qr-gallery" replace /> :
            adminPermissions.includes('bbps-history') ? <Navigate to="/bbps-history" replace /> :
            adminPermissions.includes('recharge-dashboard') ? <Navigate to="/admin/recharge-dashboard" replace /> :
            <Navigate to="/change-password" replace />
          } />
          <Route path="change-password" element={<ChangePassword adminId={userId} adminRole={adminRole} onLogout={handleLogout} />} />

          {/* Permission-Checked Routes */}
          <Route path="users-list" element={(adminRole === 'full' || adminPermissions.includes('users-list')) ? <UsersList adminRole={adminRole} /> : <Navigate to="/dashboard" replace />} />
          <Route path="super-distributors" element={(adminRole === 'full' || adminPermissions.includes('super-distributors')) ? <SuperDistributorsList /> : <Navigate to="/dashboard" replace />} />
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
          <Route path="qr-upload" element={(adminRole === 'full' || adminPermissions.includes('qr-upload')) ? <QRManagement adminRole={adminRole} adminPermissions={adminPermissions} /> : <Navigate to="/dashboard" replace />} />
          <Route path="qr-history" element={(adminRole === 'full' || adminPermissions.includes('qr-history')) ? <QRHistoryTracking adminRole={adminRole} /> : <Navigate to="/dashboard" replace />} />
          <Route path="qr-master" element={(adminRole === 'full' || adminPermissions.includes('qr-master')) ? <QRMasterManagement /> : <Navigate to="/dashboard" replace />} />
          <Route path="kyc-verification-requests" element={(adminRole === 'full' || adminPermissions.includes('kyc-verification-requests')) ? <KYCVerificationRequests /> : <Navigate to="/dashboard" replace />} />
          <Route path="qr-gallery" element={(adminRole === 'full' || adminPermissions.includes('qr-gallery')) ? <QRScreenshotGallery /> : <Navigate to="/dashboard" replace />} />
          <Route path="bbps-history" element={(adminRole === 'full' || adminPermissions.includes('bbps-history')) ? <BBPSHistory /> : <Navigate to="/dashboard" replace />} />
          <Route path="admin/recharge-dashboard" element={(adminRole === 'full' || adminPermissions.includes('recharge-dashboard')) ? <RechargeDashboard /> : <Navigate to="/dashboard" replace />} />
          
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
              <Route path="advertising" element={<Advertising />} />
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
          <Route path="fund-transfer" element={<UserFundTransfer userId={userId} />} />
          <Route path="partner-fund-transfer" element={<PartnerFundTransfer userId={userId} />} />
          <Route path="bill-payment" element={<UserBillPayment userId={userId} />} />
          <Route path="billavenue-payment" element={<UserBillAvenuePayment userId={userId} />} />
          <Route path="recharge" element={<UserRecharge userId={userId} />} />
          <Route path="bill-history" element={<UserBillHistory userId={userId} />} />
          <Route path="reports" element={<UserReports userId={userId} />} />
          <Route path="statement" element={<UserStatementReport userId={userId} />} />
          <Route path="my-users" element={<DistributorUsers userId={userId} />} />
          <Route path="users-qr-requests" element={<DistributorQRRequests userId={userId} />} />
          <Route path="users-bill-payments" element={<DistributorBillPayments userId={userId} />} />
          <Route path="users-statement" element={<DistributorStatementReport userId={userId} />} />
          <Route path="qr-distributor-report" element={<QRDistributorReport userId={userId} />} />
          <Route path="bill-distributor-report" element={<BillDistributorReport userId={userId} />} />
          <Route path="withdrawal" element={<DistributorWithdrawal userId={userId} />} />
          <Route path="dist-withdrawals" element={<SuperDistributorWithdrawals userId={userId} />} />
          <Route path="complaints" element={<UserComplaints userId={userId} />} />
          <Route path="bbps-complaints" element={<UserBBPSComplaints userId={userId} />} />
          <Route path="policies" element={<UserPolicies userId={userId} />} />
          <Route path="tpin" element={<UserTPIN userId={userId} />} />
          <Route path="change-password" element={<UserChangePassword userId={userId} onLogout={handleLogout} />} />

        </Route>
        <Route
          path="/admin-login"
          element={
            isAdmin ? <Navigate to="/dashboard" replace /> :
              isUser ? <Navigate to="/user/dashboard" replace /> :
                <Login onLogin={handleLogin} isAdminMode={true} />
          }
        />
        <Route
          path="/login"
          element={
            isAdmin ? <Navigate to="/dashboard" replace /> :
              isUser ? <Navigate to="/user/dashboard" replace /> :
                <Login onLogin={handleLogin} isAdminMode={false} />
          }
        />
      </Routes>
    </Router>
  );
}
