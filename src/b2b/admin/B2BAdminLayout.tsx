import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Menu, User, Clock } from 'lucide-react';
import B2BAdminSidebar from './B2BAdminSidebar';
import B2BPWAInstallButton from '../components/B2BPWAInstallButton';
import B2BAnimatedBackground from '../components/B2BAnimatedBackground';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';

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
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const id = localStorage.getItem('b2bAdminId');
    if (!id) {
      navigate('/b2b/admin-login');
      return;
    }
    setAdminId(id);
  }, [navigate]);

  useEffect(() => {
    fetchPendingCount();

    const channel = supabase
      .channel('b2b_layout_fund_requests')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'b2b_fund_requests' },
        () => {
          fetchPendingCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchPendingCount = async () => {
    try {
      const { count, error } = await supabase
        .from('b2b_fund_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      
      if (!error && count !== null) {
        setPendingCount(count);
      }
    } catch (err) {
      console.error('Error fetching pending fund requests count:', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('b2bAdminId');
    navigate('/b2b/admin-login');
  };

  return (
    <div className="flex min-h-screen bg-slate-900 font-sans text-slate-200 relative">
      <B2BAnimatedBackground />

      <B2BAdminSidebar
        onLogout={handleLogout}
        isCollapsed={isSidebarCollapsed}
        pendingFundRequestsCount={pendingCount}
      />

      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-900/50 backdrop-blur-sm relative z-10">
        {/* Top Header */}
        <header className="h-16 bg-slate-800/90 backdrop-blur-md border-b border-slate-700/80 flex items-center justify-between px-8 shrink-0 shadow-lg relative z-20">
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-2 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"
            >
              <Menu size={20} />
            </button>
            <h2 className="text-xl font-bold text-white capitalize hidden sm:block">
              {location.pathname.split('/').pop()?.replace('-', ' ')}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <LiveClock colorClass="text-slate-400" />
            <B2BPWAInstallButton variant="header" />

            <div className="h-8 w-px bg-slate-700 mx-2"></div>
            <div className="flex items-center gap-3 pl-2">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-white leading-none">Admin</p>
                <p className="text-xs text-slate-400 mt-1">B2B Portal</p>
              </div>
              <div className="w-10 h-10 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400 border border-indigo-500/30">
                <User size={20} />
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 relative z-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
