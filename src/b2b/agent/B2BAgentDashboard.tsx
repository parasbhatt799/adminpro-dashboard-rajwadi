import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Shield, KeyRound, Copy, Activity, RefreshCw, Terminal, Eye, EyeOff, LogOut, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { format } from 'date-fns';

export default function B2BAgentDashboard() {
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [credentials, setCredentials] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    const agentId = localStorage.getItem('b2bAgentId');
    if (!agentId) {
      navigate('/b2b/login');
      return;
    }
    
    fetchDashboardData(agentId);
  }, [navigate]);

  const fetchDashboardData = async (agentId: string) => {
    setLoading(true);
    try {
      const [credRes, logsRes] = await Promise.all([
        supabase.from('b2b_api_credentials').select('*').eq('id', agentId).single(),
        supabase.from('b2b_api_logs').select('*').eq('agent_id', agentId).order('created_at', { ascending: false }).limit(20)
      ]);

      if (credRes.data) setCredentials(credRes.data);
      if (logsRes.data) setLogs(logsRes.data);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('b2bAgentId');
    navigate('/b2b/login');
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${type} copied to clipboard`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!credentials) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-center">
        <Shield className="h-16 w-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">No API Access</h2>
        <p className="text-slate-400 mb-6">You don't have API credentials assigned. Please contact the administrator.</p>
        <button onClick={handleLogout} className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 font-medium">
          Return to Login
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Status Banner */}
        <div className={`rounded-xl p-4 flex items-center gap-4 ${credentials.is_active ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
          <div className={`p-2 rounded-full ${credentials.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <h3 className={`font-bold ${credentials.is_active ? 'text-emerald-400' : 'text-red-400'}`}>
              API Status: {credentials.is_active ? 'Active & Running' : 'Disabled'}
            </h3>
            <p className="text-slate-400 text-sm mt-0.5">
              {credentials.is_active ? 'Your API integration is currently live and accepting requests.' : 'Your API access has been temporarily suspended by the administrator.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Credentials Section */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-32 bg-indigo-500/5 blur-[100px] rounded-full pointer-events-none" />
              
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2 relative z-10">
                <KeyRound className="h-5 w-5 text-indigo-400" />
                Authentication Keys
              </h2>

              <div className="space-y-5 relative z-10">
                <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Public API Key</label>
                    <button onClick={() => copyToClipboard(credentials.api_key, 'API Key')} className="text-indigo-400 hover:text-indigo-300 text-sm flex items-center gap-1 font-medium bg-indigo-500/10 px-2 py-1 rounded">
                      <Copy className="h-3 w-3" /> Copy
                    </button>
                  </div>
                  <code className="text-emerald-400 font-mono text-sm break-all">{credentials.api_key}</code>
                </div>

                <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Secret Key</label>
                    <div className="flex gap-2">
                      <button onClick={() => setShowSecret(!showSecret)} className="text-slate-400 hover:text-white text-sm flex items-center gap-1 font-medium bg-slate-800 px-2 py-1 rounded border border-slate-700">
                        {showSecret ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />} {showSecret ? 'Hide' : 'Reveal'}
                      </button>
                      <button onClick={() => copyToClipboard(credentials.secret_key, 'Secret Key')} className="text-indigo-400 hover:text-indigo-300 text-sm flex items-center gap-1 font-medium bg-indigo-500/10 px-2 py-1 rounded">
                        <Copy className="h-3 w-3" /> Copy
                      </button>
                    </div>
                  </div>
                  <div className="font-mono text-sm break-all">
                    {showSecret ? (
                      <span className="text-amber-400">{credentials.secret_key}</span>
                    ) : (
                      <span className="text-slate-500 tracking-widest">••••••••••••••••••••••••••••••••</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* IP Whitelist Info */}
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Shield className="h-5 w-5 text-emerald-400" />
                IP Whitelist Configuration
              </h2>
              <p className="text-slate-400 text-sm mb-4">
                Only requests originating from the following IP addresses will be accepted. Contact support to add new IPs.
              </p>
              
              {credentials.ip_whitelist && credentials.ip_whitelist.length > 0 ? (
                <div className="flex flex-wrap gap-2 mt-4">
                  {credentials.ip_whitelist.map((ip: string) => (
                    <div key={ip} className="bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-2 font-mono text-sm text-slate-300">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" /> {ip}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl text-amber-400 text-sm flex items-start gap-3 mt-4">
                  <Shield className="h-5 w-5 shrink-0" />
                  <p>Your API is completely locked down. Please ask the administrator to whitelist your server's IP address.</p>
                </div>
              )}
            </div>
          </div>

          {/* Logs Section */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-xl h-full flex flex-col max-h-[800px]">
              <div className="p-5 border-b border-slate-700 flex justify-between items-center bg-slate-800/80 rounded-t-2xl">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Terminal className="h-5 w-5 text-indigo-400" />
                  Recent Requests
                </h2>
                <button 
                  onClick={() => fetchDashboardData(credentials.agent_id)}
                  className="text-slate-400 hover:text-white transition-colors p-1"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                {logs.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <Activity className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p>No API requests recorded yet.</p>
                  </div>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="p-3 bg-slate-900/50 rounded-xl border border-slate-700/50 hover:bg-slate-900 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-mono text-xs text-indigo-300 truncate max-w-[180px]">{log.endpoint}</span>
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                          log.status_code >= 200 && log.status_code < 300 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {log.status_code}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[11px] text-slate-500">
                        <span>{log.request_ip || 'Unknown IP'}</span>
                        <span>{format(new Date(log.created_at), 'MMM d, HH:mm:ss')}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
      </div>
    </div>
  );
}
