import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Menu, User, Clock } from 'lucide-react';
import B2BAdminSidebar from './B2BAdminSidebar';
import { format } from 'date-fns';

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

export default function B2BAdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [adminId, setAdminId] = useState('');

  useEffect(() => {
    const id = localStorage.getItem('b2bAdminId');
    if (!id) {
      navigate('/b2b/login');
      return;
    }
    setAdminId(id);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('b2bAdminId');
    navigate('/b2b/login');
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900">
      <B2BAdminSidebar
        onLogout={handleLogout}
        isCollapsed={isSidebarCollapsed}
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
            <h2 className="text-xl font-bold text-gray-800 capitalize hidden sm:block">
              {location.pathname.split('/').pop()?.replace('-', ' ')}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <LiveClock />

            <div className="h-8 w-px bg-slate-200 mx-2"></div>
            <div className="flex items-center gap-3 pl-2">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-900 leading-none">Admin</p>
                <p className="text-xs text-slate-500 mt-1">B2B Portal</p>
              </div>
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 border border-indigo-200">
                <User size={20} />
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
