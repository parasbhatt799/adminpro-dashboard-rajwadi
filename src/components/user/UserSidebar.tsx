import { useState } from 'react';
import {
  CreditCard,
  FileText,
  LogOut,
  MessageSquare,
  ClipboardList,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { motion } from 'motion/react';
import { NavLink } from 'react-router-dom';

interface UserSidebarProps {
  onLogout: () => void;
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/user/dashboard' },
  { id: 'payment', label: 'Payment', icon: CreditCard, path: '/user/payment' },
  { id: 'statement', label: 'Statement', icon: ClipboardList, path: '/user/statement' },
  { id: 'policies', label: 'Terms & Conditions', icon: FileText, path: '/user/policies' },
  { id: 'complaints', label: 'Complaints', icon: MessageSquare, path: '/user/complaints' },
];

export default function UserSidebar({ onLogout }: UserSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <motion.div
      initial={false}
      animate={{ width: isCollapsed ? 80 : 256 }}
      className="bg-slate-900 text-slate-300 h-screen flex flex-col border-r border-slate-800 overflow-hidden shrink-0 relative"
    >
      {/* Header */}
      <div className="p-4 h-16 flex items-center justify-between border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          {isCollapsed ? (
            <img src="/fav.png" alt="UsePay" className="w-10 h-10 object-contain shrink-0" />
          ) : (
            <motion.img
              src="/logo.png"
              alt="UsePay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-9 object-contain"
            />
          )}
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-7 h-7 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg flex items-center justify-center transition-all shrink-0"
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 no-scrollbar">
        <nav className="space-y-1">
          {menuItems.map((item) => {
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
