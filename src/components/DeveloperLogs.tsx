import React, { useState, useEffect } from 'react';
import { Terminal, Shield, Cpu, Activity, Clock, Zap, Trash2, CheckCircle, Download, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { MASTER_SQL_SCHEMA } from '../lib/master_schema';

export default function DeveloperLogs() {
  const [loading, setLoading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [logs, setLogs] = useState<{ id: string; time: string; msg: string; type: 'db' | 'auth' | 'system' }[]>([
    { id: 'initial', time: new Date().toLocaleTimeString(), msg: 'System initialized. Realtime stream active.', type: 'system' }
  ]);

  const [systemMetrics, setSystemMetrics] = useState({
    latency: 0,
    activeRequests: 0,
    blockedThreats: 0,
    healthScore: 100,
    history: [40, 50, 60, 40, 70, 80, 50, 60],
    lastScan: new Date().toLocaleTimeString()
  });

  const fetchMetrics = async () => {
    const start = performance.now();
    try {
      const [
        { count: qrCount }, 
        { count: billCount }, 
        { count: kycCount },
        { count: blockedUsers }
      ] = await Promise.all([
        supabase.from('payment_submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('bill_submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('kyc_submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('users_profiles').select('*', { count: 'exact', head: true }).eq('status', 'Blocked')
      ]);

      const end = performance.now();
      const latency = Math.round(end - start);
      const totalPending = (qrCount || 0) + (billCount || 0) + (kycCount || 0);
      const totalBlocked = (blockedUsers || 0);
      
      setSystemMetrics(prev => ({
        latency,
        activeRequests: totalPending,
        blockedThreats: totalBlocked,
        healthScore: Math.max(70, 100 - (totalPending * 2) - (latency > 500 ? 10 : 0)),
        history: [...prev.history.slice(1), Math.min(100, 30 + (totalPending * 10) + (latency / 10))],
        lastScan: new Date().toLocaleTimeString()
      }));
    } catch (err) {
      console.error('Metrics fetch error:', err);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const addLog = (msg: string, type: 'db' | 'auth' | 'system' = 'db') => {
      setLogs(prev => [
        { id: Math.random().toString(36).substr(2, 9), time: new Date().toLocaleTimeString(), msg, type },
        ...prev.slice(0, 49)
      ]);
    };

    const simulateTest = () => {
      const msgs = [
        'User Login: Session Started',
        'DB/Query: SELECT * FROM admin_profiles',
        'System/Kernel: Optimization Complete',
        'API/Sync: WebSocket connected'
      ];
      addLog(msgs[Math.floor(Math.random() * msgs.length)], 'system');
    };

    (window as any).simulateDevLog = simulateTest;

    // Subscriptions
    const channels = [
      supabase.channel('logs-users').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'users_profiles' }, (p) => {
        addLog(`User Registered: ${p.new.name || p.new.id}`);
      }),
      supabase.channel('logs-qr').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'payment_submissions' }, (p) => {
        addLog(`New QR Payment: ₹${p.new.amount} from ${p.new.user_id}`);
      }),
      supabase.channel('logs-bill').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bill_submissions' }, (p) => {
        addLog(`New Bill Payment: ₹${p.new.amount}`);
      }),
      supabase.channel('logs-kyc').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'kyc_submissions' }, (p) => {
        addLog(`KYC ${p.new.status}: ${p.new.user_id}`);
      }),
      supabase.channel('logs-system').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'system_status' }, (p) => {
        addLog(`SYSTEM STATUS UPDATED: ${p.new.message}`, 'system');
      })
    ];

    channels.forEach(channel => channel.subscribe());

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, []);
  const handleMasterExport = async () => {
    setLoading(true);
    try {
      const tables = [
        'users_profiles', 'qr_history', 'rejection_categories', 'rejection_reasons', 
        'admin_profiles', 'admin_withdrawals', 'app_policies', 'bank_details', 
        'bill_submissions', 'complaint_messages', 'complaints', 'distributor_withdrawals', 
        'headlines', 'kyc_submissions', 'notifications', 'onesignal_settings', 
        'payment_submissions', 'payout_settings', 'payout_submissions', 'qr_settings',
        'service_charge_slabs', 'system_status', 'whatsapp_api_settings'
      ];

      let sqlDump = `-- MASTER DATABASE EXPORT (TOTAL SYSTEM CLONE)
-- Generated on: ${new Date().toLocaleString()}
-- Powered by UsePay Developer Suite

${MASTER_SQL_SCHEMA}

-- =========================================
-- LIVE DATA INSERTS
-- =========================================
`;

      // 2. Fetch Data from all tables
      for (const table of tables) {
        sqlDump += `\n-- DATA FOR TABLE: public.${table}\n`;
        const { data, error } = await supabase.from(table).select('*');
        
        if (error) {
          sqlDump += `-- Error fetching data for ${table}: ${error.message}\n`;
          continue;
        }

        if (data && data.length > 0) {
          const columns = Object.keys(data[0]);
          sqlDump += `INSERT INTO public.${table} (${columns.join(', ')}) VALUES\n`;
          
          const rows = data.map(row => {
            const values = columns.map(col => {
              const val = row[col];
              if (val === null) return 'NULL';
              if (typeof val === 'number' || typeof val === 'boolean') return val;
              if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
              return `'${String(val).replace(/'/g, "''")}'`;
            });
            return `(${values.join(', ')})`;
          });

          sqlDump += rows.join(',\n') + ';\n';
        } else {
          sqlDump += `-- No data found in ${table}\n`;
        }
      }

      // 3. Trigger Download
      const blob = new Blob([sqlDump], { type: 'text/sql' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `UsePay_Master_Full_Backup_${new Date().toISOString().split('T')[0]}.sql`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setLogs(prev => [
        { id: Math.random().toString(36).substr(2, 9), time: new Date().toLocaleTimeString(), msg: 'Master SQL Full Database Export successful!', type: 'system' },
        ...prev
      ]);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFullBackup = async () => {
    setBackupLoading(true);
    setLogs(prev => [
      { id: Math.random().toString(36).substr(2, 9), time: new Date().toLocaleTimeString(), msg: 'Preparing full system backup (Database + Storage)...', type: 'system' },
      ...prev
    ]);
    
    try {
      const response = await fetch('/api/full-backup');
      if (!response.ok) throw new Error('Backup failed on server');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `UsePay_Full_Backup_${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setLogs(prev => [
        { id: Math.random().toString(36).substr(2, 9), time: new Date().toLocaleTimeString(), msg: 'Full System Backup ZIP downloaded successfully!', type: 'system' },
        ...prev
      ]);
    } catch (err: any) {
      console.error('Full Backup error:', err);
      setLogs(prev => [
        { id: Math.random().toString(36).substr(2, 9), time: new Date().toLocaleTimeString(), msg: `Backup Failed: ${err.message}`, type: 'system' },
        ...prev
      ]);
    } finally {
      setBackupLoading(false);
    }
  };

  const handleQuickBackup = async () => {
    setBackupLoading(true);
    setLogs(prev => [
      { id: Math.random().toString(36).substr(2, 9), time: new Date().toLocaleTimeString(), msg: 'Starting Quick SQL-only backup...', type: 'system' },
      ...prev
    ]);
    
    try {
      const response = await fetch('/api/full-backup?mode=quick');
      if (!response.ok) throw new Error('Backup failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `UsePay_Quick_SQL_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setLogs(prev => [
        { id: Math.random().toString(36).substr(2, 9), time: new Date().toLocaleTimeString(), msg: 'Quick SQL Backup successful!', type: 'system' },
        ...prev
      ]);
    } catch (err: any) {
      setLogs(prev => [
        { id: Math.random().toString(36).substr(2, 9), time: new Date().toLocaleTimeString(), msg: `Quick Backup Failed: ${err.message}`, type: 'system' },
        ...prev
      ]);
    } finally {
      setBackupLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">System Logs</h2>
          <p className="text-slate-500 mt-1">Real-time developer analytics and system health.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleMasterExport}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-200 transition-all active:scale-95 font-bold text-xs uppercase tracking-widest disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Master SQL Export
          </button>
          <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-1">
            <button 
              onClick={handleFullBackup}
              disabled={backupLoading}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-lg shadow-sm transition-all active:scale-95 font-bold text-[10px] uppercase tracking-widest disabled:opacity-50"
            >
              {backupLoading ? <Loader2 size={12} className="animate-spin" /> : <Shield size={12} />}
              Full (ZIP)
            </button>
            <button 
              onClick={handleQuickBackup}
              disabled={backupLoading}
              className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-900 rounded-lg shadow-sm border border-slate-200 transition-all active:scale-95 font-bold text-[10px] uppercase tracking-widest disabled:opacity-50"
            >
              Quick (SQL)
            </button>
          </div>
          <button 
            onClick={() => (window as any).simulateDevLog()}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95 font-bold text-xs uppercase tracking-widest"
          >
            <Zap size={14} />
            Test Activity
          </button>
          <button 
            onClick={() => setLogs([{ id: 'clear', time: new Date().toLocaleTimeString(), msg: 'Console cleared by Developer.', type: 'system' }])}
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-600 rounded-xl border border-slate-200 shadow-sm transition-all active:scale-95 font-bold text-xs uppercase tracking-widest"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 shadow-sm font-bold text-xs uppercase tracking-widest animate-pulse">
             <Activity size={14} />
             Live Kernels: Active
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
           <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-4">
              <Terminal size={24} />
           </div>
           <h3 className="font-bold text-slate-900 text-lg">Event Stream</h3>
           <p className="text-slate-500 text-sm mt-1">Monitor all database interactions.</p>
           <div className="mt-4 p-4 bg-slate-900 rounded-2xl font-mono text-[10px] space-y-2 h-[200px] overflow-y-auto custom-scrollbar border border-slate-800">
              <AnimatePresence initial={false}>
                {logs.map((log) => (
                  <motion.div 
                    key={log.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-start gap-2"
                  >
                    <span className="text-slate-600 shrink-0">[{log.time}]</span>
                    <span className={log.type === 'system' ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                       {log.msg}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
           </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
           <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 mb-4">
              <Shield size={24} />
           </div>
           <h3 className="font-bold text-slate-900 text-lg">Security Integrity</h3>
           <p className="text-slate-500 text-sm mt-1">Live firewall status.</p>
           
           <div className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-50">
                 <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Blocked Threats</p>
                    <p className="text-lg font-black text-rose-600 tracking-tight">{systemMetrics.blockedThreats}</p>
                 </div>
                 <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Last Scan</p>
                    <p className="text-[11px] font-bold text-slate-900 mt-1">{systemMetrics.lastScan}</p>
                 </div>
              </div>
              
              <div className="flex items-center justify-between text-xs font-bold pt-2">
                 <span className="text-slate-400 uppercase tracking-widest">Firewall Integrity</span>
                 <span className="text-emerald-500">{systemMetrics.healthScore}%</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                 <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${systemMetrics.healthScore}%` }}
                    className="h-full bg-emerald-500"
                 />
              </div>
              <div className="pt-2">
                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-2">
                    <CheckCircle size={10} className="text-emerald-500" /> Active Protection Enabled
                 </p>
              </div>
           </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
           <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 mb-4">
              <Cpu size={24} />
           </div>
           <h3 className="font-bold text-slate-900 text-lg">System Load</h3>
           <p className="text-slate-500 text-sm mt-1">Core performance metrics.</p>
           
           <div className="mt-4 grid grid-cols-2 gap-4 border-b border-slate-50 pb-4 mb-4">
              <div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Latency</p>
                 <p className="text-lg font-black text-slate-900 tracking-tight">{systemMetrics.latency}ms</p>
              </div>
              <div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pending</p>
                 <p className="text-lg font-black text-slate-900 tracking-tight">{systemMetrics.activeRequests} req</p>
              </div>
           </div>

           <div className="flex items-end gap-1 h-10">
              {systemMetrics.history.map((h, i) => (
                <motion.div 
                   key={i} 
                   initial={{ height: 0 }}
                   animate={{ height: `${h}%` }}
                   className={`flex-1 rounded-t-sm ${h > 80 ? 'bg-rose-400' : h > 50 ? 'bg-amber-400' : 'bg-indigo-400'}`}
                />
              ))}
           </div>
        </div>
      </div>

      <div className="bg-slate-900 rounded-[32px] p-10 text-center border border-slate-800 shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
        <div className="relative z-10">
          <Terminal className="text-indigo-500 mx-auto mb-6" size={48} />
          <h2 className="text-3xl font-black text-white tracking-tight mb-4">Developer Sandbox</h2>
          <p className="text-slate-400 max-w-lg mx-auto leading-relaxed">
            This panel is currently in <b>Stealth Mode</b>. Only authorized developers with the encrypted ID can view this screen. System telemetry is being recorded.
          </p>
        </div>
      </div>
    </div>
  );
}
