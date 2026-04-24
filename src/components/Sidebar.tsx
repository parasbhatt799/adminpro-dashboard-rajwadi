import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  LayoutDashboard,
  UserPlus,
  QrCode,
  Building2,
  FileQuestion,
  Receipt,
  FileBarChart,
  LogOut,
  ShieldCheck,
  MessageSquare,
  ChevronDown,
  Megaphone,
  FileText,
  Shield,
  Lock,
  Settings,
  TrendingDown,
  Wallet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { NavLink, useLocation, useNavigate, Link } from 'react-router-dom';

interface SidebarProps {
  onLogout: () => void;
  isCollapsed: boolean;
  adminRole: string;
  pendingCounts: { qr: number; bill: number; kyc: number; payout: number };
  isDeveloper: boolean;
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { id: 'users-list', label: 'Users list', icon: UserPlus, path: '/users-list', role: 'full' },
  { id: 'distributors', label: 'Distributors', icon: Building2, path: '/distributors', role: 'full' },
  { id: 'qr-payment-requests', label: 'QR Payment Request', icon: QrCode, path: '/qr-payment-requests' },
  { id: 'bill-payment-requests', label: 'Bill Payment Request', icon: Receipt, path: '/bill-payment-requests' },
  { id: 'payout-requests', label: 'Payout Request', icon: TrendingDown, path: '/payout-requests' },
  { id: 'distributor-withdrawals', label: 'Dist. Withdrawals', icon: Wallet, path: '/distributor-withdrawals', role: 'full' },
  { id: 'kyc-verification-requests', label: 'KYC Verification Request', icon: ShieldCheck, path: '/kyc-verification-requests', role: 'full' },
  { id: 'qr-upload', label: 'QR upload', icon: QrCode, path: '/qr-upload', role: 'full' },
  { id: 'bank-upload', label: 'Bank Upload', icon: Building2, path: '/bank-upload' },
  { id: 'reason-entry', label: 'Reason entry', icon: FileQuestion, path: '/reason-entry' },
  { id: 'service-charge', label: 'Service charge', icon: Receipt, path: '/service-charge' },
  { id: 'withdrawal-balance', label: 'Withdrawal Balance', icon: TrendingDown, path: '/withdrawal-balance', role: 'full' },
  {
    id: 'report-generate',
    label: 'Report Generate',
    icon: FileBarChart,
    path: '/reports/qr-payment',
    role: 'full',
    subItems: [
      { label: 'QR Payment Report', path: '/reports/qr-payment' },
      { label: 'Bill Payment Report', path: '/reports/bill-payment' },
      { label: 'Payout Report', path: '/reports/payout' },
      { label: 'Statement Report', path: '/reports/statement' }
    ]
  },
  { id: 'complaints-management', label: 'Complaints Management', icon: MessageSquare, path: '/complaints-management' },
  { id: 'headlines', label: 'Add Anouncement', icon: Megaphone, path: '/headlines' },
  { id: 'policies', label: 'Terms & Conditions', icon: FileText, path: '/policies' },
  { id: 'user-agreement', label: 'User Agreement', icon: ShieldCheck, path: '/agreement' },
  { id: 'admin-management', label: 'Admin Management', icon: Shield, path: '/admin-management', role: 'full' },
  { id: 'change-password', label: 'Change Password', icon: Lock, path: '/change-password', role: 'full' },
  { id: 'settings', label: 'Business Settings', icon: Settings, path: '/settings', role: 'full' },
  { id: 'developer-logs', label: 'System Logs', icon: FileText, path: '/developer-logs', role: 'developer' },
];

export default function Sidebar({ onLogout, isCollapsed, adminRole, pendingCounts, isDeveloper }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [branding, setBranding] = useState<{logo: string, mini: string, fav: string}>({ logo: '/logo.png', mini: '/fav.png', fav: '/fav.png' });

  useEffect(() => {
    const fetchBranding = async () => {
      const { data } = await supabase.from('qr_settings').select('logo_url, logo_mini_url, favicon_url').eq('id', 1).single();
      if (data) {
        setBranding({
          logo: data.logo_url || '/logo.png',
          mini: data.logo_mini_url || data.favicon_url || '/fav.png',
          fav: data.favicon_url || '/fav.png'
        });
      }
    };
    fetchBranding();

    const channel = supabase.channel('branding_admin')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'qr_settings', filter: 'id=eq.1' }, (payload) => {
        if (payload.new) {
          setBranding({
            logo: payload.new.logo_url || '/logo.png',
            mini: payload.new.logo_mini_url || payload.new.favicon_url || '/fav.png',
            fav: payload.new.favicon_url || '/fav.png'
          });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const filteredMenuItems = menuItems.filter(item => {
    if (item.role === 'developer') return isDeveloper;
    return !item.role || item.role === adminRole;
  });
  const [reportsExpanded, setReportsExpanded] = useState(() => {
    return location.pathname.startsWith('/reports');
  });

  return (
    <motion.div
      initial={false}
      animate={{ width: isCollapsed ? 80 : 256 }}
      className="bg-slate-900 text-slate-300 h-screen flex flex-col border-r border-slate-800 overflow-hidden shrink-0"
    >
      <div className="px-4 h-20 flex items-center border-b border-slate-800 shrink-0">
        <Link to="/" className="flex items-center gap-3 group w-full">
          {isCollapsed ? (
            <img src={branding.mini} alt="Logo" className="w-10 h-10 object-contain transition-transform group-hover:scale-110 mx-auto" />
          ) : (
            <motion.img
              src={branding.logo}
              alt="Logo"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-12 w-auto max-w-full object-contain transition-transform group-hover:scale-105"
            />
          )}
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 no-scrollbar">
        <nav className="space-y-1">
          {filteredMenuItems.map((item) => {
            const Icon = item.icon;
            const isReports = item.id === 'report-generate';
            const isActive = isReports
              ? location.pathname.startsWith('/reports')
              : location.pathname === item.path;

            if (isReports) {
              return (
                <div key={item.id} className="space-y-1">
                  <button
                    onClick={() => {
                      if (isCollapsed) {
                        navigate(item.path);
                      } else {
                        setReportsExpanded(!reportsExpanded);
                        // Default navigate to QR report if not already in reports
                        if (!location.pathname.startsWith('/reports')) {
                          navigate(item.path);
                        }
                      }
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative ${isActive
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                      : 'hover:bg-slate-800 hover:text-white'
                      }`}
                  >
                    <Icon size={20} className={`shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                    {!isCollapsed && (
                      <>
                        <motion.span
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="font-medium text-sm whitespace-nowrap"
                        >
                          {item.label}
                        </motion.span>
                        <motion.div
                          animate={{ rotate: reportsExpanded ? 180 : 0 }}
                          className="ml-auto"
                        >
                          <ChevronDown size={16} />
                        </motion.div>
                      </>
                    )}
                  </button>

                  <AnimatePresence>
                    {!isCollapsed && reportsExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden bg-slate-800/30 rounded-xl"
                      >
                        {item.subItems?.map((sub) => (
                          <NavLink
                            key={sub.path}
                            to={sub.path}
                            className={({ isActive }) => `block py-2.5 pl-11 pr-4 text-xs font-medium transition-colors ${isActive ? 'text-white bg-white/5' : 'text-slate-400 hover:text-white hover:bg-white/5'
                              }`}
                          >
                            {sub.label}
                          </NavLink>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            }

            return (
              <NavLink
                key={item.id}
                to={item.path}
                title={isCollapsed ? item.label : ""}
                className={({ isActive }) => `w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative ${isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                  : 'hover:bg-slate-800 hover:text-white'
                  }`}
              >
                {({ isActive }) => (
                  <>
                    <Icon size={20} className={`shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                    {!isCollapsed && (
                      <motion.span
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="font-medium text-sm whitespace-nowrap"
                      >
                        {item.label}
                      </motion.span>
                    )}

                    {/* Pending Count Badges */}
                    {!isCollapsed && (
                      <div className="ml-auto flex items-center gap-1.5">
                        {item.id === 'qr-payment-requests' && pendingCounts.qr > 0 && (
                          <span className="bg-rose-500 text-[10px] font-bold text-white px-2 py-0.5 rounded-full min-w-[20px] text-center shadow-sm shadow-rose-500/20 animate-pulse">
                            {pendingCounts.qr}
                          </span>
                        )}
                        {item.id === 'bill-payment-requests' && pendingCounts.bill > 0 && (
                          <span className="bg-rose-500 text-[10px] font-bold text-white px-2 py-0.5 rounded-full min-w-[20px] text-center shadow-sm shadow-rose-500/20 animate-pulse">
                            {pendingCounts.bill}
                          </span>
                        )}
                        {item.id === 'payout-requests' && pendingCounts.payout > 0 && (
                          <span className="bg-rose-500 text-[10px] font-bold text-white px-2 py-0.5 rounded-full min-w-[20px] text-center shadow-sm shadow-rose-500/20 animate-pulse">
                            {pendingCounts.payout}
                          </span>
                        )}
                        {item.id === 'kyc-verification-requests' && pendingCounts.kyc > 0 && (
                          <span className="bg-rose-500 text-[10px] font-bold text-white px-2 py-0.5 rounded-full min-w-[20px] text-center shadow-sm shadow-rose-500/20 animate-pulse">
                            {pendingCounts.kyc}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Collapsed Badges (Small dots) */}
                    {isCollapsed && (
                      <>
                        {((item.id === 'qr-payment-requests' && pendingCounts.qr > 0) ||
                          (item.id === 'bill-payment-requests' && pendingCounts.bill > 0) ||
                          (item.id === 'payout-requests' && pendingCounts.payout > 0) ||
                          (item.id === 'kyc-verification-requests' && pendingCounts.kyc > 0)) && (
                          <div className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-slate-900 animate-pulse" />
                        )}
                      </>
                    )}

                    {isActive && !isCollapsed && !['qr-payment-requests', 'bill-payment-requests', 'payout-requests', 'kyc-verification-requests'].includes(item.id) && (
                      <motion.div
                        layoutId="active-pill"
                        className="ml-auto w-1.5 h-1.5 rounded-full bg-white"
                      />
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-slate-800 shrink-0">
        <button
          onClick={onLogout}
          title={isCollapsed ? "Logout" : ""}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-500 transition-colors group"
        >
          <LogOut size={20} className="shrink-0" />
          {!isCollapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-medium text-sm whitespace-nowrap"
            >
              Logout
            </motion.span>
          )}
        </button>
      </div>
    </motion.div>
  );
}
