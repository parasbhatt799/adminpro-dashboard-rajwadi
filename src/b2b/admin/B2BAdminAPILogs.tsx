import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Terminal,
  Activity,
  CheckCircle2,
  Clock,
  ShieldAlert,
  AlertTriangle,
  Search,
  RefreshCw,
  Copy,
  Check,
  Eye,
  Filter,
  X,
  Play,
  Pause,
  ExternalLink,
  ShieldCheck,
  ArrowUpDown,
  Download,
  Server,
  Zap,
  Globe,
  Radio
} from 'lucide-react';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

export interface B2BAPILogItem {
  id: string;
  agent_id: string | null;
  endpoint: string;
  request_ip: string | null;
  request_payload: any;
  response_payload: any;
  status_code: number;
  created_at: string;
  charge_deducted?: number;
  payment_status?: string;
  developer_charge?: number;
  owner_charge?: number;
}

interface AgentInfo {
  id: string;
  b2b_login_id: string;
  first_name?: string;
  last_name?: string;
  ip_whitelist?: string[];
}

export default function B2BAdminAPILogs() {
  const [logs, setLogs] = useState<B2BAPILogItem[]>([]);
  const [agents, setAgents] = useState<Record<string, AgentInfo>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isLiveStreaming, setIsLiveStreaming] = useState(true);
  const [selectedLog, setSelectedLog] = useState<B2BAPILogItem | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | '200' | '202' | '401' | '400' | '500'>('ALL');
  const [agentFilter, setAgentFilter] = useState<string>('ALL');
  const [endpointFilter, setEndpointFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<'today' | '24h' | '7d' | 'all'>('today');

  // Copied states
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [isAddingIp, setIsAddingIp] = useState(false);
  const [whitelistSuccessMsg, setWhitelistSuccessMsg] = useState<string | null>(null);

  const channelRef = useRef<any>(null);

  // Copy to clipboard helper
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Fetch agents mapping for quick name & whitelist lookup
  const fetchAgents = async () => {
    try {
      const { data, error } = await supabase
        .from('b2b_api_credentials')
        .select('id, b2b_login_id, first_name, last_name, ip_whitelist');
      if (error) throw error;
      if (data) {
        const map: Record<string, AgentInfo> = {};
        data.forEach(ag => {
          map[ag.id] = ag;
        });
        setAgents(map);
      }
    } catch (err) {
      console.error('[B2B Logs] Failed to fetch agents:', err);
    }
  };

  // Fetch API Logs
  const fetchLogs = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      let query = supabase
        .from('b2b_api_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);

      // Date filter
      const now = new Date();
      if (dateFilter === 'today') {
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        query = query.gte('created_at', startOfToday);
      } else if (dateFilter === '24h') {
        const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        query = query.gte('created_at', past24h);
      } else if (dateFilter === '7d') {
        const past7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte('created_at', past7d);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data) {
        setLogs(data);
      }
    } catch (err) {
      console.error('[B2B Logs] Error fetching logs:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAgents();
    fetchLogs();
  }, [dateFilter]);

  // Real-time listener for incoming API logs
  useEffect(() => {
    if (!isLiveStreaming) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    const channel = supabase
      .channel('b2b_api_logs_live_traffic')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'b2b_api_logs' },
        (payload) => {
          const newLog = payload.new as B2BAPILogItem;
          setLogs((prev) => [newLog, ...prev.slice(0, 299)]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'b2b_api_logs' },
        (payload) => {
          const updatedLog = payload.new as B2BAPILogItem;
          setLogs((prev) =>
            prev.map((log) => (log.id === updatedLog.id ? updatedLog : log))
          );
          if (selectedLog && selectedLog.id === updatedLog.id) {
            setSelectedLog(updatedLog);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [isLiveStreaming, selectedLog]);

  // Quick 1-click Whitelist IP handler for 401 blocked IPs
  const handleQuickWhitelistIp = async (targetAgentId: string, ipToWhitelist: string) => {
    if (!targetAgentId || !ipToWhitelist) return;
    setIsAddingIp(true);
    setWhitelistSuccessMsg(null);
    try {
      const agent = agents[targetAgentId];
      const currentList: string[] = agent?.ip_whitelist || [];
      if (currentList.includes(ipToWhitelist)) {
        setWhitelistSuccessMsg(`IP ${ipToWhitelist} is already in the whitelist!`);
        setIsAddingIp(false);
        return;
      }

      const updatedList = [...currentList, ipToWhitelist];
      const { error } = await supabase
        .from('b2b_api_credentials')
        .update({ ip_whitelist: updatedList })
        .eq('id', targetAgentId);

      if (error) throw error;

      // Update local state
      setAgents((prev) => ({
        ...prev,
        [targetAgentId]: {
          ...prev[targetAgentId],
          ip_whitelist: updatedList
        }
      }));

      setWhitelistSuccessMsg(`✅ IP ${ipToWhitelist} successfully whitelisted for ${agent?.b2b_login_id || 'Agent'}!`);
      setTimeout(() => setWhitelistSuccessMsg(null), 5000);
    } catch (err: any) {
      console.error('[Quick Whitelist Error]', err);
      alert('Failed to whitelist IP: ' + (err.message || 'Unknown error'));
    } finally {
      setIsAddingIp(false);
    }
  };

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Status filter
      if (statusFilter !== 'ALL') {
        const codeStr = String(log.status_code);
        if (statusFilter === '200' && codeStr !== '200') return false;
        if (statusFilter === '202' && codeStr !== '202') return false;
        if (statusFilter === '401' && codeStr !== '401') return false;
        if (statusFilter === '400' && codeStr !== '400') return false;
        if (statusFilter === '500' && !codeStr.startsWith('5')) return false;
      }

      // Agent filter
      if (agentFilter !== 'ALL') {
        if (log.agent_id !== agentFilter) return false;
      }

      // Endpoint filter
      if (endpointFilter !== 'ALL') {
        if (!log.endpoint.includes(endpointFilter)) return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const ip = (log.request_ip || '').toLowerCase();
        const endpoint = (log.endpoint || '').toLowerCase();
        const status = String(log.status_code);
        const agent = agents[log.agent_id || ''];
        const agentName = `${agent?.b2b_login_id || ''} ${agent?.first_name || ''} ${agent?.last_name || ''}`.toLowerCase();
        const reqStr = JSON.stringify(log.request_payload || {}).toLowerCase();
        const resStr = JSON.stringify(log.response_payload || {}).toLowerCase();

        return (
          ip.includes(query) ||
          endpoint.includes(query) ||
          status.includes(query) ||
          agentName.includes(query) ||
          reqStr.includes(query) ||
          resStr.includes(query)
        );
      }

      return true;
    });
  }, [logs, statusFilter, agentFilter, endpointFilter, searchTerm, agents]);

  // Statistics calculation
  const stats = useMemo(() => {
    let total = logs.length;
    let s200 = 0;
    let s202 = 0;
    let s401 = 0;
    let s400 = 0;
    let s500 = 0;

    logs.forEach((log) => {
      const code = log.status_code;
      if (code === 200) s200++;
      else if (code === 202) s202++;
      else if (code === 401) s401++;
      else if (code === 400) s400++;
      else if (code >= 500) s500++;
    });

    return { total, s200, s202, s401, s400, s500 };
  }, [logs]);

  // Status badge styling helper
  const renderStatusBadge = (code: number) => {
    if (code === 200) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 size={13} />
          200 OK
        </span>
      );
    }
    if (code === 202) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <Clock size={13} />
          202 Pending
        </span>
      );
    }
    if (code === 401) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <ShieldAlert size={13} />
          401 Unauthorized
        </span>
      );
    }
    if (code === 400) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/20">
          <AlertTriangle size={13} />
          400 Bad Request
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
        <Server size={13} />
        {code || 500} Error
      </span>
    );
  };

  // Helper for response error summary preview
  const getSummary = (log: B2BAPILogItem) => {
    const res = log.response_payload || {};
    const req = log.request_payload || {};

    if (res.message) return String(res.message);
    if (res.error) return String(res.error);
    if (res.billerResponse?.responseReason) return String(res.billerResponse.responseReason);
    if (res.billPayResponse?.responseReason) return String(res.billPayResponse.responseReason);
    if (res.ExtBillPayResponse?.responseReason) return String(res.ExtBillPayResponse.responseReason);
    if (log.payment_status === 'auth_failed') return 'Authentication / Whitelist blocked';
    if (log.payment_status) return `Payment status: ${log.payment_status}`;
    if (req.transaction_id) return `Txn: ${req.transaction_id}`;
    return 'Success';
  };

  // Relative time helper
  const getRelativeTime = (isoDate: string) => {
    try {
      const now = new Date();
      const past = new Date(isoDate);
      const diffSec = Math.floor((now.getTime() - past.getTime()) / 1000);

      if (diffSec < 5) return 'Just now';
      if (diffSec < 60) return `${diffSec}s ago`;
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return past.toLocaleDateString();
    } catch {
      return '';
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto min-h-screen text-slate-100">
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800/80 backdrop-blur-xl shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
              <Terminal size={26} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Developer API Logs & Traffic Inspector
                </h1>
                {isLiveStreaming ? (
                  <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 animate-pulse">
                    <Radio size={12} className="text-emerald-400" />
                    LIVE
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                    <Pause size={12} />
                    PAUSED
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-400 mt-1">
                Real-time inspection of all incoming B2B API requests, blocked IPs, authentication errors, and payload data.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setIsLiveStreaming(!isLiveStreaming)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border transition-all ${
              isLiveStreaming
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {isLiveStreaming ? <Pause size={14} /> : <Play size={14} />}
            {isLiveStreaming ? 'Pause Stream' : 'Resume Live'}
          </button>

          <button
            onClick={() => fetchLogs(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Metrics Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Calls */}
        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Total Requests</span>
            <Activity size={16} className="text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">{stats.total}</div>
          <div className="text-[11px] text-slate-500 mt-1">In current window</div>
        </div>

        {/* 200 OK */}
        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Success (200)</span>
            <CheckCircle2 size={16} className="text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 tracking-tight">{stats.s200}</div>
          <div className="text-[11px] text-emerald-500/80 mt-1">Completed</div>
        </div>

        {/* 202 Pending */}
        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Pending (202)</span>
            <Clock size={16} className="text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 tracking-tight">{stats.s202}</div>
          <div className="text-[11px] text-amber-500/80 mt-1">In-flight / Processing</div>
        </div>

        {/* 401 Unauthorized / IP Blocked */}
        <div className={`p-4 rounded-xl border backdrop-blur-sm transition-all ${
          stats.s401 > 0 ? 'bg-rose-500/10 border-rose-500/30' : 'bg-slate-900/60 border-slate-800/80'
        }`}>
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span className={stats.s401 > 0 ? 'text-rose-400 font-semibold' : ''}>Auth Blocked (401)</span>
            <ShieldAlert size={16} className="text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400 tracking-tight">{stats.s401}</div>
          <div className="text-[11px] text-rose-400/80 mt-1">IP Whitelist / Keys</div>
        </div>

        {/* 400 Bad Request */}
        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Client Error (400)</span>
            <AlertTriangle size={16} className="text-orange-400" />
          </div>
          <div className="text-2xl font-bold text-orange-400 tracking-tight">{stats.s400}</div>
          <div className="text-[11px] text-orange-500/80 mt-1">Validation / Balance</div>
        </div>

        {/* 500 Server Error */}
        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Gateway Err (500)</span>
            <Server size={16} className="text-red-400" />
          </div>
          <div className="text-2xl font-bold text-red-400 tracking-tight">{stats.s500}</div>
          <div className="text-[11px] text-red-500/80 mt-1">Upstream Failures</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="text"
              placeholder="Search by IP, Endpoint, Error reason, Agent, or Transaction ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Quick Date Presets */}
          <div className="flex items-center bg-slate-950/60 p-1 rounded-xl border border-slate-800 shrink-0">
            <button
              onClick={() => setDateFilter('today')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                dateFilter === 'today' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setDateFilter('24h')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                dateFilter === '24h' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              24h
            </button>
            <button
              onClick={() => setDateFilter('7d')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                dateFilter === '7d' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setDateFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                dateFilter === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              All
            </button>
          </div>
        </div>

        {/* Dropdown Filters Row */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-800/60 text-xs">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Statuses ({logs.length})</option>
              <option value="200">200 OK ({stats.s200})</option>
              <option value="202">202 Pending ({stats.s202})</option>
              <option value="401">401 Unauthorized / Whitelist ({stats.s401})</option>
              <option value="400">400 Bad Request ({stats.s400})</option>
              <option value="500">500 Server Error ({stats.s500})</option>
            </select>
          </div>

          {/* Agent Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Agent:</span>
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 max-w-[200px] truncate"
            >
              <option value="ALL">All Agents</option>
              {Object.values(agents).map((ag) => (
                <option key={ag.id} value={ag.id}>
                  {ag.b2b_login_id} {ag.first_name ? `(${ag.first_name})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Endpoint Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Endpoint:</span>
            <select
              value={endpointFilter}
              onChange={(e) => setEndpointFilter(e.target.value)}
              className="bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Endpoints</option>
              <option value="/pay-bill">/pay-bill</option>
              <option value="/fetch-bill">/fetch-bill</option>
              <option value="/balance">/balance</option>
              <option value="/status">/status</option>
              <option value="/payout">/payout</option>
              <option value="/fund-request">/fund-request</option>
              <option value="/billers">/billers</option>
            </select>
          </div>

          {/* Active Filter Chips Reset */}
          {(statusFilter !== 'ALL' || agentFilter !== 'ALL' || endpointFilter !== 'ALL' || searchTerm) && (
            <button
              onClick={() => {
                setStatusFilter('ALL');
                setAgentFilter('ALL');
                setEndpointFilter('ALL');
                setSearchTerm('');
              }}
              className="ml-auto text-xs text-indigo-400 hover:text-indigo-300 underline"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Traffic Table */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800/80 overflow-hidden shadow-xl">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <LoadingSpinner />
            <p className="text-sm text-slate-400">Loading B2B API traffic logs...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <Terminal size={40} className="mx-auto text-slate-600" />
            <div className="text-slate-300 font-medium">No API logs match your filter criteria</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              When B2B agents send API requests or attempt authentication, live hits will appear here instantly.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Method & Endpoint</th>
                  <th className="py-3 px-4">Caller IP</th>
                  <th className="py-3 px-4">Agent / Caller</th>
                  <th className="py-3 px-4">Response / Error Preview</th>
                  <th className="py-3 px-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredLogs.map((log) => {
                  const agent = log.agent_id ? agents[log.agent_id] : null;
                  const isBlockedIp =
                    log.status_code === 401 &&
                    JSON.stringify(log.response_payload || {}).includes('not whitelisted');

                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className={`hover:bg-slate-800/40 cursor-pointer transition-colors ${
                        isBlockedIp ? 'bg-rose-500/[0.04]' : ''
                      }`}
                    >
                      {/* Time */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-mono text-xs text-slate-300">
                          {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {getRelativeTime(log.created_at)}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {renderStatusBadge(log.status_code)}
                      </td>

                      {/* Method & Endpoint */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase font-mono ${
                              log.endpoint.includes('pay-bill') || log.endpoint.includes('payout')
                                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                : log.endpoint.includes('fetch-bill')
                                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}
                          >
                            {log.request_payload?.method || (log.endpoint.includes('balance') || log.endpoint.includes('categories') ? 'GET' : 'POST')}
                          </span>
                          <span className="font-mono text-xs text-slate-200 font-medium">
                            {log.endpoint}
                          </span>
                        </div>
                      </td>

                      {/* Caller IP */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 group">
                          <span className="font-mono text-xs text-slate-300 bg-slate-950/70 px-2 py-0.5 rounded border border-slate-800">
                            {log.request_ip || '127.0.0.1'}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(log.request_ip || '127.0.0.1', log.id + '-ip');
                            }}
                            title="Copy IP"
                            className="text-slate-500 hover:text-white p-1 rounded transition-colors"
                          >
                            {copiedText === log.id + '-ip' ? (
                              <Check size={13} className="text-emerald-400" />
                            ) : (
                              <Copy size={13} />
                            )}
                          </button>
                        </div>
                        {isBlockedIp && (
                          <div className="text-[10px] font-semibold text-rose-400 mt-0.5 flex items-center gap-1">
                            <ShieldAlert size={10} /> Not in Whitelist!
                          </div>
                        )}
                      </td>

                      {/* Agent */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {agent ? (
                          <div>
                            <div className="text-xs font-semibold text-slate-200">
                              {agent.b2b_login_id}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {agent.first_name || ''} {agent.last_name || ''}
                            </div>
                          </div>
                        ) : log.agent_id ? (
                          <div className="font-mono text-xs text-slate-400 truncate max-w-[120px]">
                            {log.agent_id}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500 italic">Unauthenticated</span>
                        )}
                      </td>

                      {/* Response / Error Preview */}
                      <td className="py-3 px-4 max-w-xs truncate text-xs">
                        <span
                          className={
                            log.status_code >= 400
                              ? 'text-rose-400 font-medium'
                              : log.status_code === 202
                              ? 'text-amber-400 font-medium'
                              : 'text-slate-300'
                          }
                          title={getSummary(log)}
                        >
                          {getSummary(log)}
                        </span>
                      </td>

                      {/* Inspect Button */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
                        >
                          <Eye size={13} />
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inspect Modal / Slide-over */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
                  <Terminal size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-base font-bold text-white">
                      {selectedLog.endpoint}
                    </span>
                    {renderStatusBadge(selectedLog.status_code)}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {new Date(selectedLog.created_at).toLocaleString()} • IP:{' '}
                    <span className="font-mono text-slate-300">{selectedLog.request_ip || '127.0.0.1'}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedLog(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Whitelist Assistant Banner (If 401 Unauthorized IP Error) */}
            {selectedLog.status_code === 401 &&
              JSON.stringify(selectedLog.response_payload || {}).includes('not whitelisted') && (
                <div className="bg-rose-500/10 border-b border-rose-500/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <ShieldAlert size={20} className="text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-semibold text-rose-300">
                        IP Whitelist Rejection Detected!
                      </div>
                      <p className="text-xs text-rose-200/80 mt-0.5">
                        Client IP <code className="bg-rose-950 px-1.5 py-0.5 rounded text-white font-mono">{selectedLog.request_ip}</code> was blocked because it has not been whitelisted for agent{' '}
                        <strong>{selectedLog.agent_id && agents[selectedLog.agent_id]?.b2b_login_id ? agents[selectedLog.agent_id].b2b_login_id : 'this agent'}</strong>.
                      </p>
                    </div>
                  </div>

                  {selectedLog.agent_id && selectedLog.request_ip && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() =>
                          handleQuickWhitelistIp(selectedLog.agent_id!, selectedLog.request_ip!)
                        }
                        disabled={isAddingIp}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-600/30 disabled:opacity-50"
                      >
                        <ShieldCheck size={14} />
                        {isAddingIp ? 'Whitelisting...' : '1-Click Whitelist This IP'}
                      </button>
                    </div>
                  )}
                </div>
              )}

            {whitelistSuccessMsg && (
              <div className="bg-emerald-500/10 border-b border-emerald-500/30 p-3 text-xs text-emerald-400 font-medium text-center">
                {whitelistSuccessMsg}
              </div>
            )}

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {/* Quick Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-500 block mb-0.5">Agent</span>
                  <span className="font-semibold text-slate-200">
                    {selectedLog.agent_id && agents[selectedLog.agent_id]
                      ? `${agents[selectedLog.agent_id].b2b_login_id} (${agents[selectedLog.agent_id].first_name || ''})`
                      : 'None / Unknown'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">Caller IP</span>
                  <span className="font-mono font-medium text-slate-200">
                    {selectedLog.request_ip || '127.0.0.1'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">HTTP Status</span>
                  <span className="font-bold text-slate-200">
                    {selectedLog.status_code}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">Payment Status</span>
                  <span className="font-semibold uppercase tracking-wider text-slate-300">
                    {selectedLog.payment_status || 'N/A'}
                  </span>
                </div>
              </div>

              {/* Request Payload */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Globe size={14} className="text-indigo-400" />
                    Incoming Request Payload
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(
                        JSON.stringify(selectedLog.request_payload || {}, null, 2),
                        'req-payload'
                      )
                    }
                    className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    {copiedText === 'req-payload' ? <Check size={13} /> : <Copy size={13} />}
                    {copiedText === 'req-payload' ? 'Copied' : 'Copy JSON'}
                  </button>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 font-mono text-xs overflow-x-auto max-h-72">
                  <pre className="text-slate-300">
                    {JSON.stringify(selectedLog.request_payload || {}, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Response Payload */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Server size={14} className="text-emerald-400" />
                    Outgoing Response Payload
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(
                        JSON.stringify(selectedLog.response_payload || {}, null, 2),
                        'res-payload'
                      )
                    }
                    className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    {copiedText === 'res-payload' ? <Check size={13} /> : <Copy size={13} />}
                    {copiedText === 'res-payload' ? 'Copied' : 'Copy JSON'}
                  </button>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 font-mono text-xs overflow-x-auto max-h-72">
                  <pre
                    className={
                      selectedLog.status_code >= 400
                        ? 'text-rose-300'
                        : selectedLog.status_code === 202
                        ? 'text-amber-300'
                        : 'text-emerald-300'
                    }
                  >
                    {JSON.stringify(selectedLog.response_payload || {}, null, 2)}
                  </pre>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-mono">
                Log ID: {selectedLog.id}
              </span>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded-xl transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
