/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
import StatementReport from './components/StatementReport';
import HeadlineManagement from './components/HeadlineManagement';
import PolicyManagement from './components/PolicyManagement';
import AdminManagement from './components/AdminManagement';
import ChangePassword from './components/ChangePassword';
import Login from './components/Login';
import UserPanel from './components/user/UserPanel';
import UserPayment from './components/user/UserPayment';
import UserReports from './components/user/UserReports';
import UserComplaints from './components/user/UserComplaints';
import UserPolicies from './components/user/UserPolicies';
import UserStatementReport from './components/user/UserStatementReport';
import UserDashboard from './components/user/UserDashboard';
import UserChangePassword from './components/user/UserChangePassword';
import { Search, Bell, User, Menu, MessageSquare, Clock, ShieldCheck, Trash2 } from 'lucide-react';
import { supabase } from './lib/supabase';
import { formatDistanceToNow, parseISO, format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

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
  adminRole
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
            <div className="relative w-96">
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
            <div className="relative">
              <button 
                type="button"
                onClick={() => setShowAdminNotifications(!showAdminNotifications)}
                className={`p-2 rounded-lg transition-all relative ${
                  showAdminNotifications ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
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
  const [isUser, setIsUser] = useState(() => localStorage.getItem('userType') === 'user');
  const [userId, setUserId] = useState(() => localStorage.getItem('userId') || '');
  const [adminRole, setAdminRole] = useState(() => localStorage.getItem('adminRole') || 'full');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // Admin Notification States
  const [adminNotifications, setAdminNotifications] = useState<any[]>([]);
  const [unreadAdminCount, setUnreadAdminCount] = useState(0);
  const [showAdminNotifications, setShowAdminNotifications] = useState(false);

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
    if (isAdmin) {
      fetchAdminNotifications();

      const channel = supabase
        .channel('admin_notifications_realtime')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'notifications'
        }, (payload: any) => {
          const notification = payload.new;
          if (notification && (notification.target_role === 'admin' || !notification.user_id)) {
            fetchAdminNotifications();
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isAdmin]);

  const handleLogin = (id: string, userType: 'admin' | 'user', role?: string) => {
    localStorage.setItem('userId', id);
    localStorage.setItem('userType', userType);
    if (role) localStorage.setItem('adminRole', role);
    
    if (userType === 'admin') {
      setIsAdmin(true);
      setIsUser(false);
      setAdminRole(role || 'full');
    } else {
      setIsUser(true);
      setIsAdmin(false);
    }
    setUserId(id);
  };

  const handleLogout = () => {
    localStorage.removeItem('userId');
    localStorage.removeItem('userType');
    localStorage.removeItem('adminRole');
    setIsAdmin(false);
    setIsUser(false);
    setUserId('');
    setAdminRole('full');
  };

  return (
    <Router>
      <Routes>
        <Route 
          path="/" 
          element={
            !isAdmin ? (
              <Navigate to="/login" replace />
            ) : (
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
              />
            )
          } 
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="users-list" element={<UsersList />} />
          <Route path="qr-upload" element={<QRManagement />} />
          <Route path="bank-upload" element={<BankManagement />} />
          <Route path="service-charge" element={<ServiceChargeManagement />} />
          <Route path="qr-payment-requests" element={<QRPaymentRequests />} />
          <Route path="bill-payment-requests" element={<BillPaymentRequests />} />
          <Route path="kyc-verification-requests" element={<KYCVerificationRequests />} />
          <Route path="reason-entry" element={<ReasonManagement />} />
          <Route path="complaints-management" element={<ComplaintsManagement />} />
          <Route path="reports">
            <Route path="qr-payment" element={<QRPaymentReport />} />
            <Route path="bill-payment" element={<BillPaymentReport />} />
            <Route path="statement" element={<StatementReport />} />
          </Route>
          <Route path="headlines" element={<HeadlineManagement />} />
          <Route path="policies" element={<PolicyManagement />} />
          {adminRole === 'full' && (
            <>
              <Route path="admin-management" element={<AdminManagement currentAdminId={userId} adminRole={adminRole} onLogout={handleLogout} />} />
              <Route path="change-password" element={<ChangePassword adminId={userId} adminRole={adminRole} />} />
            </>
          )}
        </Route>
        <Route 
          path="/user" 
          element={
            !isUser ? (
              <Navigate to="/login" replace />
            ) : (
              <UserPanel onLogout={handleLogout} userId={userId} />
            )
          } 
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<UserDashboard userId={userId} />} />
          <Route path="payment" element={<UserPayment userId={userId} />} />
          <Route path="reports" element={<UserReports userId={userId} />} />
          <Route path="statement" element={<UserStatementReport userId={userId} />} />
          <Route path="complaints" element={<UserComplaints userId={userId} />} />
          <Route path="policies" element={<UserPolicies userId={userId} />} />
          <Route path="change-password" element={<UserChangePassword userId={userId} onLogout={handleLogout} />} />
        </Route>
        <Route 
          path="/login" 
          element={
            isAdmin ? (
              <Navigate to="/" replace />
            ) : isUser ? (
              <Navigate to="/user" replace />
            ) : (
              <Login onLogin={handleLogin} />
            )
          } 
        />
      </Routes>
    </Router>
  );
}
