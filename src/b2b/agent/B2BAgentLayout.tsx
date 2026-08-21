import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { Terminal, LogOut, Wallet, Book, LayoutDashboard, Activity, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

import B2BPWAInstallButton from '../components/B2BPWAInstallButton';

export default function B2BAgentLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [fixedDepositAmount, setFixedDepositAmount] = useState<number>(0);
  const [agentProfile, setAgentProfile] = useState<{ first_name?: string; last_name?: string; profile_photo_url?: string } | null>(null);

  useEffect(() => {
    const agentId = localStorage.getItem('b2bAgentId');
    if (!agentId) {
      navigate('/b2b/agent-login');
      return;
    }

    fetchBalance(agentId);

    // Subscribe to balance changes
    const channel = supabase
      .channel('b2b_balance_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'b2b_api_credentials',
          filter: `id=eq.${agentId}`
        },
        (payload) => {
          setWalletBalance(payload.new.wallet_balance || 0);
          setFixedDepositAmount(payload.new.fixed_deposit_amount || 0);
          if (payload.new.profile_photo_url) {
            setAgentProfile(prev => ({ ...prev, profile_photo_url: payload.new.profile_photo_url }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [navigate]);

  const fetchBalance = async (agentId: string) => {
    try {
      const { data } = await supabase
        .from('b2b_api_credentials')
        .select('wallet_balance, fixed_deposit_amount, first_name, last_name, profile_photo_url')
        .eq('id', agentId)
        .single();
        
      if (data) {
        setWalletBalance(data.wallet_balance || 0);
        setFixedDepositAmount(data.fixed_deposit_amount || 0);
        setAgentProfile({
          first_name: data.first_name,
          last_name: data.last_name,
          profile_photo_url: data.profile_photo_url
        });
      }
    } catch (err) {
      console.error('Error fetching balance:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('b2bAgentId');
    navigate('/b2b/agent-login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const isActive = (path: string) => location.pathname.includes(path);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans">
      {/* Top Navbar */}
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-30 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            
            <div className="flex items-center gap-6">
              <Link to="/b2b/agent/dashboard" className="flex items-center gap-3">
                <img src="/logo.png" alt="Logo" className="h-10 max-h-12 object-contain" />
              </Link>

              {/* Navigation Links */}
              <nav className="hidden md:flex items-center gap-1 ml-4 border-l border-slate-700 pl-6">
                <Link 
                  to="/b2b/agent/dashboard" 
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive('dashboard') ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                >
                  <LayoutDashboard className="h-4 w-4" /> Dashboard
                </Link>
                <Link 
                  to="/b2b/agent/fund-request" 
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive('fund-request') ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                >
                  <Wallet className="h-4 w-4" /> Fund Request
                </Link>
                <Link 
                  to="/b2b/agent/api-docs" 
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive('api-docs') ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                >
                  <Book className="h-4 w-4" /> API Docs
                </Link>
                <Link 
                  to="/b2b/agent/bill-history" 
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive('bill-history') ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                >
                  <Activity className="h-4 w-4" /> Bill History
                </Link>
              </nav>
            </div>

            <div className="flex items-center gap-3">
              {/* B2B PWA Install Button */}
              <B2BPWAInstallButton variant="header" />

              {/* Wallet Balance Display */}
              <div className="flex items-center gap-3 bg-slate-900/80 px-4 py-2 rounded-xl border border-slate-700">
                <Wallet className="h-4 w-4 text-emerald-400" />
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase leading-none mb-1">
                    {fixedDepositAmount > 0 ? 'Total Wallet' : 'Wallet Balance'}
                  </span>
                  <span className="text-emerald-400 font-bold leading-none tracking-tight">₹ {walletBalance.toFixed(2)}</span>
                </div>
                {fixedDepositAmount > 0 && (
                  <>
                    <div className="flex flex-col border-l border-slate-700 pl-3">
                      <span className="text-[10px] text-amber-400 font-semibold uppercase leading-none mb-1">🔒 Deposit Frozen</span>
                      <span className="text-amber-400 font-bold leading-none tracking-tight">₹ {fixedDepositAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex flex-col border-l border-slate-700 pl-3">
                      <span className="text-[10px] text-cyan-400 font-semibold uppercase leading-none mb-1">Usable Balance</span>
                      <span className="text-cyan-400 font-bold leading-none tracking-tight">₹ {Math.max(0, walletBalance - fixedDepositAmount).toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Agent Profile Avatar */}
              {agentProfile && (
                <div className="flex items-center gap-2 bg-slate-900/50 px-3 py-1.5 rounded-xl border border-slate-700/70">
                  {agentProfile.profile_photo_url ? (
                    <img
                      src={agentProfile.profile_photo_url}
                      alt="Agent Avatar"
                      className="w-7 h-7 rounded-full object-cover border border-slate-600"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center text-xs font-bold">
                      {agentProfile.first_name?.[0]?.toUpperCase() || <User size={14} />}
                    </div>
                  )}
                  <span className="text-xs font-semibold text-slate-200 hidden lg:inline-block">
                    {agentProfile.first_name} {agentProfile.last_name}
                  </span>
                </div>
              )}

              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors font-medium text-sm bg-slate-700/50 hover:bg-slate-700 px-4 py-2 rounded-lg border border-slate-600/50 hidden sm:flex"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
        
        {/* Mobile Nav */}
        <div className="md:hidden border-t border-slate-700 bg-slate-800 px-4 py-2 flex items-center overflow-x-auto gap-2">
          <B2BPWAInstallButton variant="badge" className="flex-shrink-0" />
           <Link to="/b2b/agent/dashboard" className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${isActive('dashboard') ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400'}`}>
              <LayoutDashboard className="h-4 w-4" /> Dashboard
            </Link>
            <Link to="/b2b/agent/fund-request" className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${isActive('fund-request') ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400'}`}>
              <Wallet className="h-4 w-4" /> Funds
            </Link>
            <Link to="/b2b/agent/api-docs" className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${isActive('api-docs') ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400'}`}>
              <Book className="h-4 w-4" /> Docs
            </Link>
            <Link to="/b2b/agent/bill-history" className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${isActive('bill-history') ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400'}`}>
              <Activity className="h-4 w-4" /> Bill History
            </Link>
        </div>
      </header>

      {/* Page Content */}
      <div className="w-full py-8 px-4 sm:px-6 lg:px-8">
        <Outlet />
      </div>
    </div>
  );
}
