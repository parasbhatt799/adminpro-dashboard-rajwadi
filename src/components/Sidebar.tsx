import React, { useState } from 'react';
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
  Megaphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';

interface SidebarProps {
  onLogout: () => void;
  isCollapsed: boolean;
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { id: 'users-list', label: 'Users list', icon: UserPlus, path: '/users-list' },
  { id: 'qr-payment-requests', label: 'QR Payment Request', icon: QrCode, path: '/qr-payment-requests' },
  { id: 'bill-payment-requests', label: 'Bill Payment Request', icon: Receipt, path: '/bill-payment-requests' },
  { id: 'kyc-verification-requests', label: 'KYC Verification Request', icon: ShieldCheck, path: '/kyc-verification-requests' },
  { id: 'qr-upload', label: 'QR upload', icon: QrCode, path: '/qr-upload' },
  { id: 'bank-upload', label: 'Bank Upload', icon: Building2, path: '/bank-upload' },
  { id: 'reason-entry', label: 'Reason entry', icon: FileQuestion, path: '/reason-entry' },
  { id: 'service-charge', label: 'Service charge', icon: Receipt, path: '/service-charge' },
  { 
    id: 'report-generate', 
    label: 'Report Generate', 
    icon: FileBarChart, 
    path: '/reports/qr-payment',
    subItems: [
      { label: 'QR Payment Report', path: '/reports/qr-payment' },
      { label: 'Bill Payment Report', path: '/reports/bill-payment' },
      { label: 'Statement Report', path: '/reports/statement' }
    ]
  },
  { id: 'complaints-management', label: 'Complaints Management', icon: MessageSquare, path: '/complaints-management' },
  { id: 'headlines', label: 'Add Headline', icon: Megaphone, path: '/headlines' },
];

export default function Sidebar({ onLogout, isCollapsed }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [reportsExpanded, setReportsExpanded] = useState(() => {
    return location.pathname.startsWith('/reports');
  });

  return (
    <motion.div 
      initial={false}
      animate={{ width: isCollapsed ? 80 : 256 }}
      className="bg-slate-900 text-slate-300 h-screen flex flex-col border-r border-slate-800 overflow-hidden shrink-0"
    >
      <div className="p-4 h-16 flex items-center border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
            <span className="text-white font-bold">A</span>
          </div>
          {!isCollapsed && (
            <motion.h1 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xl font-bold text-white tracking-tight whitespace-nowrap"
            >
              AdminPro
            </motion.h1>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 no-scrollbar">
        <nav className="space-y-1">
          {menuItems.map((item) => {
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
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative ${
                      isActive 
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
                            className={({ isActive }) => `block py-2.5 pl-11 pr-4 text-xs font-medium transition-colors ${
                              isActive ? 'text-white bg-white/5' : 'text-slate-400 hover:text-white hover:bg-white/5'
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
                className={({ isActive }) => `w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative ${
                  isActive 
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
                    {isActive && !isCollapsed && (
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
