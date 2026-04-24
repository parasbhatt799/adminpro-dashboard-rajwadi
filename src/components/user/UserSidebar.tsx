import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  CreditCard,
  FileText,
  LogOut,
  MessageSquare,
  ClipboardList,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Wallet,
  Receipt,
  FileBarChart
} from 'lucide-react';
import { motion } from 'motion/react';
import { NavLink, Link } from 'react-router-dom';

interface UserSidebarProps {
  onLogout: () => void;
  isCollapsed: boolean;
  role?: string;
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/user/dashboard' },
  { id: 'payment', label: 'Payment', icon: CreditCard, path: '/user/payment' },
  { id: 'statement', label: 'Statement', icon: ClipboardList, path: '/user/statement' },
  { id: 'policies', label: 'Terms & Conditions', icon: FileText, path: '/user/policies' },
  { id: 'complaints', label: 'Complaints', icon: MessageSquare, path: '/user/complaints' },
  { id: 'change-password', label: 'Security', icon: KeyRound, path: '/user/change-password' },
];

export default function UserSidebar({ onLogout, isCollapsed, role }: UserSidebarProps) {
  const [branding, setBranding] = useState<{logo: string, mini: string, fav: string}>({ logo: '/logo.png', mini: '/fav.png', fav: '/fav.png' });

  const distributorItems = role === 'distributor' ? [
    { id: 'my-users', label: 'My Users', icon: ClipboardList, path: '/user/my-users' },
    { id: 'users-qr-requests', label: 'Users QR Requests', icon: FileText, path: '/user/users-qr-requests' },
    { id: 'users-bill-payments', label: 'Users Bill Payment', icon: Receipt, path: '/user/users-bill-payments' },
    { id: 'users-statement', label: 'Users Statement', icon: FileBarChart, path: '/user/users-statement' },
    { id: 'withdrawal', label: 'Withdraw Commission', icon: Wallet, path: '/user/withdrawal' },
  ] : [];

  const finalMenuItems = [
    ...menuItems.slice(0, 1),
    ...distributorItems,
    ...menuItems.slice(1).filter(item => {
      if (role === 'distributor' && (item.id === 'payment' || item.id === 'statement')) {
        return false;
      }
      return true;
    })
  ];

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

    const channel = supabase.channel('branding_user')
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

  return (
    <motion.div
      initial={false}
      animate={{ width: isCollapsed ? 80 : 256 }}
      className="bg-slate-900 text-slate-300 h-screen flex flex-col border-r border-slate-800 overflow-hidden shrink-0 relative"
    >
      {/* Header */}
      <div className="px-4 h-20 flex items-center justify-between border-b border-slate-800 shrink-0">
        <Link to="/" className="flex items-center gap-3 overflow-hidden group w-full">
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

      {/* Nav */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 no-scrollbar">
        <nav className="space-y-1">
          {finalMenuItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.id}
                to={item.path}
                title={isCollapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group ${
                    isCollapsed ? 'justify-center' : ''
                  } ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                      : 'hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={20} className={`shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                    {!isCollapsed && (
                      <span className="font-medium text-sm whitespace-nowrap">{item.label}</span>
                    )}
                    {isActive && !isCollapsed && (
                      <motion.div
                        layoutId="active-pill-user"
                        className="ml-auto w-1.5 h-1.5 rounded-full bg-white shrink-0"
                      />
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Footer */}
      {!isCollapsed && (
        <div className="px-4 py-2 text-center flex items-center justify-center gap-1 bg-slate-800/20">
          <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Developed by</span>
          <a
            href="https://codefixer.in"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[8px] font-black text-emerald-500 hover:text-emerald-400 transition-colors uppercase tracking-widest"
          >
            codefixer.in
          </a>
        </div>
      )}

      <div className={`p-4 border-t border-slate-800 ${isCollapsed ? 'flex justify-center' : ''}`}>
        <button
          onClick={onLogout}
          title={isCollapsed ? 'Logout' : undefined}
          className={`flex items-center gap-3 px-3 py-3 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-500 transition-colors ${
            isCollapsed ? 'justify-center w-auto' : 'w-full'
          }`}
        >
          <LogOut size={20} className="shrink-0" />
          {!isCollapsed && <span className="font-medium text-sm">Logout</span>}
        </button>
      </div>
    </motion.div>
  );
}
