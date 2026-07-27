import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { LayoutDashboard, UserPlus, LogOut, Terminal, Wallet, Book, Activity } from 'lucide-react';
import { motion } from 'motion/react';

interface B2BAdminSidebarProps {
  onLogout: () => void;
  isCollapsed: boolean;
}

const menuItems = [
  { id: 'dashboard', label: 'B2B Dashboard', icon: LayoutDashboard, path: '/b2b/admin/dashboard' },
  { id: 'fund-requests', label: 'Fund Requests', icon: Wallet, path: '/b2b/admin/fund-requests' },
  { id: 'create-agent', label: 'B2B Agents', icon: UserPlus, path: '/b2b/admin/create-agent' },
  { id: 'bill-history', label: 'API Bill History', icon: Activity, path: '/b2b/admin/bill-history' },
  { id: 'api-docs', label: 'API Docs', icon: Book, path: '/b2b/admin/api-docs' },
];

export default function B2BAdminSidebar({ onLogout, isCollapsed }: B2BAdminSidebarProps) {
  return (
    <motion.div
      initial={false}
      animate={{ width: isCollapsed ? 80 : 256 }}
      className="bg-slate-900 text-slate-300 h-screen flex flex-col border-r border-slate-800 overflow-hidden shrink-0"
    >
      <div className="px-4 h-20 flex items-center justify-center border-b border-slate-800 shrink-0">
        <Link to="/b2b/admin/dashboard" className="flex items-center gap-3 group w-full justify-center">
          <div className="bg-indigo-600 p-2 rounded-lg shrink-0">
            <Terminal className="h-6 w-6 text-white" />
          </div>
          {!isCollapsed && (
            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-bold text-white whitespace-nowrap text-lg"
            >
              B2B Admin
            </motion.h1>
          )}
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
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
