import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { Terminal, LogOut, Wallet, Book, LayoutDashboard, Activity, User, Receipt, Zap, Landmark } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

import B2BPWAInstallButton from '../components/B2BPWAInstallButton';

export default function B2BAgentLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [payoutWalletBalance, setPayoutWalletBalance] = useState<number>(0);
  const [csplWalletBalance, setCsplWalletBalance] = useState<number>(0);
  const [fixedDepositAmount, setFixedDepositAmount] = useState<number>(0);
  const [isBbpsEnabled, setIsBbpsEnabled] = useState<boolean>(true);
  const [isPayoutEnabled, setIsPayoutEnabled] = useState<boolean>(false);
  const [isCsplEnabled, setIsCsplEnabled] = useState<boolean>(false);
  const [agentProfile, setAgentProfile] = useState<{ first_name?: string; last_name?: string; profile_photo_url?: string } | null>(null);

  useEffect(() => {
    const agentId = localStorage.getItem('b2bAgentId');
    if (!agentId) {
      navigate('/b2b/agent-login');
      return;
    }

    // Subscribe to real-time wallet and permission changes
    const channel = supabase
      .channel('agent_wallet_channel')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'b2b_api_credentials',
          filter: `id=eq.${agentId}`,
        },
        (payload: any) => {
          setWalletBalance(payload.new.wallet_balance || 0);
          setPayoutWalletBalance(payload.new.payout_wallet_balance || 0);
          setCsplWalletBalance(payload.new.cspl_wallet_balance || 0);
          setFixedDepositAmount(payload.new.fixed_deposit_amount || 0);
          if (payload.new.is_bbps_enabled !== undefined) setIsBbpsEnabled(payload.new.is_bbps_enabled !== false);
          if (payload.new.is_payout_enabled !== undefined) setIsPayoutEnabled(!!payload.new.is_payout_enabled);
          if (payload.new.is_cspl_enabled !== undefined) setIsCsplEnabled(!!payload.new.is_cspl_enabled);
          setAgentProfile({
            first_name: payload.new.first_name,
            last_name: payload.new.last_name,
            profile_photo_url: payload.new.profile_photo_url
          });
        }
      )
      .subscribe();

    fetchWalletBalance(agentId);

    return () => {
      supabase.removeChannel(channel);
    };
  }, [navigate]);

  const fetchWalletBalance = async (agentId: string) => {
    try {
      const { data, error } = await supabase
        .from('b2b_api_credentials')
        .select('wallet_balance, payout_wallet_balance, cspl_wallet_balance, fixed_deposit_amount, first_name, last_name, profile_photo_url, is_bbps_enabled, is_payout_enabled, is_cspl_enabled')
        .eq('id', agentId)
        .single();

      if (!error && data) {
        setWalletBalance(data.wallet_balance || 0);
        setPayoutWalletBalance(data.payout_wallet_balance || 0);
        setCsplWalletBalance(data.cspl_wallet_balance || 0);
        setFixedDepositAmount(data.fixed_deposit_amount || 0);
        setIsBbpsEnabled(data.is_bbps_enabled !== false);
        setIsPayoutEnabled(!!data.is_payout_enabled);
        setIsCsplEnabled(!!data.is_cspl_enabled);
        setAgentProfile({
          first_name: data.first_name,
          last_name: data.last_name,
          profile_photo_url: data.profile_photo_url
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const isActive = (path: string) => {
    return location.pathname.includes(path);
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

  const isBothServices = isBbpsEnabled && isPayoutEnabled;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans">
      {/* Top Navbar */}
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-30 shadow-lg">
        <div className="w-full px-4 sm:px-6 lg:px-8">
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
                  to="/b2b/agent/statement" 
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive('statement') ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                >
                  <Receipt className="h-4 w-4" /> Statement
                </Link>

                {/* Single API Documentation Menu Item */}
                <Link 
                  to="/b2b/agent/api-docs" 
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive('api-docs') ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                >
                  <Book className="h-4 w-4" /> Documentation
                </Link>

                {/* Bill History (Only shown if BBPS service is enabled) */}
                {isBbpsEnabled && (
                  <Link 
                    to="/b2b/agent/bill-history" 
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive('bill-history') ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                  >
                    <Activity className="h-4 w-4" /> Bill History
                  </Link>
                )}

                {/* Payout History (Only shown if Payout service is enabled) */}
                {isPayoutEnabled && (
                  <Link 
                    to="/b2b/agent/payout-history" 
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive('payout-history') ? 'bg-purple-500/20 text-purple-400' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                  >
                    <Zap className="h-4 w-4" /> Payout History
                  </Link>
                )}
              </nav>
            </div>

            <div className="flex items-center gap-3">
              {/* B2B PWA Install Button */}
              <B2BPWAInstallButton variant="header" />

              {/* Dedicated Wallet Balance Displays */}
              <div className="flex items-center gap-2">
                {isBbpsEnabled && (
                  <div className="flex items-center gap-2.5 bg-slate-900/80 px-3.5 py-1.5 rounded-xl border border-slate-700 shadow-sm">
                    <Wallet className="h-4 w-4 text-emerald-400 shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-[9px] text-slate-400 font-semibold uppercase leading-none mb-0.5">
                        {isBothServices ? 'BBPS Wallet' : (fixedDepositAmount > 0 ? 'Total BBPS' : 'Wallet Balance')}
                      </span>
                      <span className="text-emerald-400 font-bold text-xs sm:text-sm leading-none">
                        ₹ {walletBalance.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                {isPayoutEnabled && (
                  <div className="flex items-center gap-2.5 bg-slate-900/80 px-3.5 py-1.5 rounded-xl border border-purple-500/30 shadow-sm">
                    <Zap className="h-4 w-4 text-purple-400 shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-[9px] text-purple-300 font-semibold uppercase leading-none mb-0.5">
                        Payout Wallet
                      </span>
                      <span className="text-purple-400 font-bold text-xs sm:text-sm leading-none">
                        ₹ {payoutWalletBalance.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                {isCsplEnabled && (
                  <div className="flex items-center gap-2.5 bg-slate-900/80 px-3.5 py-1.5 rounded-xl border border-blue-500/30 shadow-sm">
                    <Landmark className="h-4 w-4 text-blue-400 shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-[9px] text-blue-300 font-semibold uppercase leading-none mb-0.5">
                        CSPL Wallet
                      </span>
                      <span className="text-blue-400 font-bold text-xs sm:text-sm leading-none">
                        ₹ {csplWalletBalance.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Agent Profile Photo or Initials */}
              <div className="flex items-center gap-2 pl-2 border-l border-slate-700">
                {agentProfile?.profile_photo_url ? (
                  <img
                    src={agentProfile.profile_photo_url}
                    alt="Agent Profile"
                    className="w-9 h-9 rounded-full object-cover border border-indigo-500/40 shadow-sm"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-bold text-xs uppercase shadow-sm">
                    {agentProfile?.first_name ? agentProfile.first_name[0] : <User className="w-4 h-4" />}
                  </div>
                )}
                <div className="hidden lg:flex flex-col text-left">
                  <span className="text-xs font-semibold text-white leading-tight">
                    {agentProfile?.first_name ? `${agentProfile.first_name} ${agentProfile.last_name || ''}` : 'Agent'}
                  </span>
                  <span className="text-[10px] text-slate-400 leading-tight">B2B Portal</span>
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700/50 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Mobile Nav */}
        <div className="md:hidden border-t border-slate-700 bg-slate-800 px-4 py-2 flex items-center overflow-x-auto gap-2">
          <B2BPWAInstallButton variant="badge" className="flex-shrink-0" />
          <Link to="/b2b/agent/dashboard" className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${isActive('dashboard') ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400'}`}>
            <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
          </Link>
          <Link to="/b2b/agent/fund-request" className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${isActive('fund-request') ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400'}`}>
            <Wallet className="h-3.5 w-3.5" /> Funds
          </Link>
          <Link to="/b2b/agent/statement" className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${isActive('statement') ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400'}`}>
            <Receipt className="h-3.5 w-3.5" /> Statement
          </Link>

          {/* Mobile Single Documentation Link */}
          <Link to="/b2b/agent/api-docs" className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${isActive('api-docs') ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400'}`}>
            <Book className="h-3.5 w-3.5" /> Documentation
          </Link>

          {isBbpsEnabled && (
            <Link to="/b2b/agent/bill-history" className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${isActive('bill-history') ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400'}`}>
              <Activity className="h-3.5 w-3.5" /> Bill History
            </Link>
          )}

          {isPayoutEnabled && (
            <Link to="/b2b/agent/payout-history" className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${isActive('payout-history') ? 'bg-purple-500/20 text-purple-400' : 'text-slate-400'}`}>
              <Zap className="h-3.5 w-3.5" /> Payout History
            </Link>
          )}

        </div>
      </header>

      {/* Page Content */}
      <div className="w-full py-8 px-4 sm:px-6 lg:px-8">
        <Outlet />
      </div>
    </div>
  );
}
