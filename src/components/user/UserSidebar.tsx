import { 
  LayoutDashboard, 
  CreditCard, 
  FileText,
  LogOut
} from 'lucide-react';
import { motion } from 'motion/react';

interface UserSidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
}

const menuItems = [
  { id: 'payment', label: 'Payment', icon: CreditCard },
  { id: 'reports', label: 'Reports', icon: FileText },
];

export default function UserSidebar({ activeTab, setActiveTab, onLogout }: UserSidebarProps) {
  return (
    <div className="w-64 bg-slate-900 text-slate-300 h-screen flex flex-col border-r border-slate-800">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold">U</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">UserPanel</h1>
        </div>

        <nav className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                  isActive 
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' 
                    : 'hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon size={20} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'} />
                <span className="font-medium text-sm">{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="active-pill-user"
                    className="ml-auto w-1.5 h-1.5 rounded-full bg-white"
                  />
                )}
              </button>
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
