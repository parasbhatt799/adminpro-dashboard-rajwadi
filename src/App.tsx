/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
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
import Login from './components/Login';
import UserPanel from './components/user/UserPanel';
import UserPayment from './components/user/UserPayment';
import UserReports from './components/user/UserReports';
import UserComplaints from './components/user/UserComplaints';
import { Search, Bell, User, Menu } from 'lucide-react';
import { supabase } from './lib/supabase';

export default function App() {
  const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem('userType') === 'admin');
  const [isUser, setIsUser] = useState(() => localStorage.getItem('userType') === 'user');
  const [userId, setUserId] = useState(() => localStorage.getItem('userId') || '');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [pendingKYCCount, setPendingKYCCount] = useState(0);

  useEffect(() => {
    if (isAdmin) {
      const fetchPendingKYC = async () => {
        const { count } = await supabase
          .from('kyc_submissions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');
        setPendingKYCCount(count || 0);
      };

      fetchPendingKYC();

      // Real-time subscription for KYC requests
      const channel = supabase
        .channel('kyc_changes')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'kyc_submissions' 
        }, () => {
          fetchPendingKYC();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isAdmin]);

  const handleLogin = (id: string, userType: 'admin' | 'user') => {
    localStorage.setItem('userId', id);
    localStorage.setItem('userType', userType);
    
    if (userType === 'admin') {
      setIsAdmin(true);
      setIsUser(false);
    } else {
      setIsUser(true);
      setIsAdmin(false);
    }
    setUserId(id);
  };

  const handleLogout = () => {
    localStorage.removeItem('userId');
    localStorage.removeItem('userType');
    setIsAdmin(false);
    setIsUser(false);
    setUserId('');
  };

  const AdminLayout = () => {
    const location = useLocation();
    const currentTab = location.pathname.substring(1) || 'dashboard';

    return (
      <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900">
        <Sidebar 
          onLogout={handleLogout} 
          isCollapsed={isSidebarCollapsed}
        />
        
        <main className="flex-1 flex flex-col h-screen overflow-hidden">
          {/* Top Header */}
          <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
            <div className="flex items-center gap-6">
              <button 
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
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button 
                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors relative"
              >
                <Bell size={20} />
                {pendingKYCCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
                    {pendingKYCCount}
                  </span>
                )}
              </button>
              <div className="h-8 w-px bg-slate-200 mx-2"></div>
              <div className="flex items-center gap-3 pl-2">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-bold text-slate-900 leading-none">Admin #{userId}</p>
                  <p className="text-xs text-slate-500 mt-1">Super Admin</p>
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

  return (
    <Router>
      <Routes>
        <Route 
          path="/" 
          element={
            !isAdmin ? (
              <Navigate to="/login" replace />
            ) : (
              <AdminLayout />
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
          <Route path="report-generate" element={<PageUnderConstruction tab="report-generate" />} />
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
          <Route index element={<Navigate to="payment" replace />} />
          <Route path="payment" element={<UserPayment userId={userId} />} />
          <Route path="reports" element={<UserReports userId={userId} />} />
          <Route path="complaints" element={<UserComplaints userId={userId} />} />
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

