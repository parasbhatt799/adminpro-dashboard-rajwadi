import { 
  CreditCard, 
  FileText,
  LogOut,
  MessageSquare,
  ClipboardList
} from 'lucide-react';
import { motion } from 'motion/react';
import { NavLink } from 'react-router-dom';

interface UserSidebarProps {
  onLogout: () => void;
}

const menuItems = [
  { id: 'payment', label: 'Payment', icon: CreditCard, path: '/user/payment' },
  { id: 'statement', label: 'Statement', icon: ClipboardList, path: '/user/statement' },
  { id: 'complaints', label: 'Complaints', icon: MessageSquare, path: '/user/complaints' },
];

export default function UserSidebar({ onLogout }: UserSidebarProps) {
  return (
    <div className="w-64 bg-slate-900 text-slate-300 h-screen flex flex-col border-r border-slate-800">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-8">
          <img src="/logo.png" alt="UsePay" className="h-9 object-contain" />
        </div>

        <nav className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            
            return (
              <NavLink
                key={item.id}
                to={item.path}
                className={({ isActive }) => `w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                  isActive 
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' 
                    : 'hover:bg-slate-800 hover:text-white'
                }`}
              >
                {({ isActive }) => (
                  <>
                    <Icon size={20} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'} />
                    <span className="font-medium text-sm">{item.label}</span>
                    {isActive && (
                      <motion.div
                        layoutId="active-pill-user"
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

      <div className="mt-auto p-6 border-t border-slate-800">
        <button 
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-500 transition-colors"
        >
          <LogOut size={20} />
          <span className="font-medium text-sm">Logout</span>
        </button>
      </div>
    </div>
  );
}
