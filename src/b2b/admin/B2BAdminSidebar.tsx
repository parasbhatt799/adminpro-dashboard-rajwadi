import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { LayoutDashboard, UserPlus, LogOut, Terminal, Wallet, Book, Activity, Landmark, ArrowUpRight, MessageSquare } from 'lucide-react';
import { motion } from 'motion/react';

interface B2BAdminSidebarProps {
  onLogout: () => void;
  isCollapsed: boolean;
  pendingFundRequestsCount?: number;
}

const menuItems = [
  { id: 'dashboard', label: 'B2B Dashboard', icon: LayoutDashboard, path: '/b2b/admin/dashboard' },
  { id: 'revenue-withdrawals', label: 'Revenue Withdrawals', icon: ArrowUpRight, path: '/b2b/admin/withdrawals' },
  { id: 'fund-requests', label: 'Fund Requests', icon: Wallet, path: '/b2b/admin/fund-requests' },
  { id: 'bank-accounts', label: 'Bank Accounts', icon: Landmark, path: '/b2b/admin/bank-accounts' },
  { id: 'create-agent', label: 'B2B Agents', icon: UserPlus, path: '/b2b/admin/create-agent' },
  { id: 'bill-history', label: 'API Bill History', icon: Activity, path: '/b2b/admin/bill-history' },
  { id: 'whatsapp-bot', label: 'WhatsApp Bot', icon: MessageSquare, path: '/b2b/admin/whatsapp' },
  { id: 'api-docs', label: 'API Docs', icon: Book, path: '/b2b/admin/api-docs' },
];

export default function B2BAdminSidebar({ onLogout, isCollapsed, pendingFundRequestsCount = 0 }: B2BAdminSidebarProps) {
  return (
    <motion.div
      initial={false}
      animate={{ width: isCollapsed ? 80 : 256 }}
      className="bg-slate-900 text-slate-300 h-screen flex flex-col border-r border-slate-800 overflow-hidden shrink-0"
    >
      <div className="px-4 h-20 flex items-center justify-center border-b border-slate-800 shrink-0">
        <Link to="/b2b/admin/dashboard" className="flex items-center gap-3 group w-full justify-center">
          {isCollapsed ? (
            <img src="/fav.png" alt="Logo" className="h-9 w-9 object-contain" />
          ) : (
            <img src="/logo.png" alt="Logo" className="h-10 max-h-12 max-w-full object-contain" />
          )}
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isFundReq = item.id === 'fund-requests';
            const showBadge = isFundReq && pendingFundRequestsCount > 0;

            return (
              <NavLink
                key={item.id}
                to={item.path}
                title={isCollapsed ? (showBadge ? `${item.label} (${pendingFundRequestsCount} pending)` : item.label) : ""}
                className={({ isActive }) => `w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative ${isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                  : 'hover:bg-slate-800 hover:text-white'
                  }`}
              >
                {({ isActive }) => (
                  <>
                    <div className="relative flex items-center justify-center">
                      <Icon size={20} className={`shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                      {isCollapsed && showBadge && (
                        <span className="absolute -top-2 -right-2 bg-amber-500 text-slate-950 font-black text-[10px] h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center leading-none shadow-sm animate-pulse">
                          {pendingFundRequestsCount > 99 ? '99+' : pendingFundRequestsCount}
                        </span>
                      )}
                    </div>
                    {!isCollapsed && (
                      <>
                        <motion.span
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="font-medium text-sm whitespace-nowrap"
                        >
                          {item.label}
                        </motion.span>
                        {showBadge && (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="ml-auto bg-amber-500 text-slate-950 font-black text-xs px-2 py-0.5 rounded-full shadow-sm animate-pulse"
                          >
                            {pendingFundRequestsCount > 99 ? '99+' : pendingFundRequestsCount}
                          </motion.span>
                        )}
                      </>
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
