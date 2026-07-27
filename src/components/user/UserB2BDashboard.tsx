import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { KeyRound, Copy, Terminal, AlertCircle, Eye, EyeOff } from 'lucide-react';
import LoadingSpinner from '../shared/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { format } from 'date-fns';

interface B2BLog {
  id: string;
  endpoint: string;
  request_ip: string;
  status_code: number;
  created_at: string;
}

interface UserB2BDashboardProps {
  userId: string;
}

export default function UserB2BDashboard({ userId }: UserB2BDashboardProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [credentials, setCredentials] = useState<any>(null);
  const [logs, setLogs] = useState<B2BLog[]>([]);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, [userId]);

  const fetchDashboardData = async () => {
    setLoading(true);
    
    // Fetch Credentials
    const { data: credData, error: credError } = await supabase
      .from('b2b_api_credentials')
      .select('*')
      .eq('agent_id', userId)
      .single();

    if (credError && credError.code !== 'PGRST116') {
      console.error(credError);
      toast.error('Failed to load API credentials');
    } else if (credData) {
      setCredentials(credData);
      
      // Fetch recent logs
      const { data: logsData } = await supabase
        .from('b2b_api_logs')
        .select('*')
        .eq('agent_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
        
      if (logsData) {
        setLogs(logsData);
      }
    }
    
    setLoading(false);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!credentials) {
    return (
      <div className="p-6 max-w-4xl mx-auto mt-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Terminal className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">B2B API Access Not Enabled</h2>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            You do not currently have access to our B2B API. If you are interested in integrating with our BillAvenue API, please contact an administrator to get your API keys generated.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Terminal className="h-6 w-6 text-indigo-600" />
          B2B API Dashboard
        </h1>
        <p className="text-gray-500 mt-1">Manage your API integration and view request logs.</p>
      </div>

      {!credentials.is_active && (
        <div className="bg-red-50 text-red-800 p-4 rounded-lg flex items-start gap-3 border border-red-100">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-red-600" />
          <div>
            <h3 className="font-semibold text-red-900">API Access Disabled</h3>
            <p className="text-sm mt-1">Your API access is currently disabled. Any API requests made using these credentials will be rejected. Contact an administrator for assistance.</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-gray-500" />
          <h3 className="font-semibold text-gray-900">Authentication Keys</h3>
        </div>
        
        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
            <div className="flex">
              <div className="flex-1 bg-gray-50 p-3 rounded-l-lg border border-gray-200 border-r-0 overflow-x-auto">
                <code className="text-gray-800 font-mono text-sm">{credentials.api_key}</code>
              </div>
              <button
                onClick={() => handleCopy(credentials.api_key)}
                className="bg-gray-100 border border-gray-200 border-l-0 rounded-r-lg px-4 flex items-center text-gray-600 hover:bg-gray-200 hover:text-indigo-600 transition-colors"
                title="Copy API Key"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">Pass this in the <code>x-api-key</code> header of your requests.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Secret Key</label>
            <div className="flex">
              <div className="flex-1 bg-gray-50 p-3 rounded-l-lg border border-gray-200 border-r-0 overflow-x-auto">
                <code className="text-gray-800 font-mono text-sm">
                  {showSecret ? credentials.secret_key : '••••••••••••••••••••••••••••••••••••••••'}
                </code>
              </div>
              <button
                onClick={() => setShowSecret(!showSecret)}
                className="bg-gray-100 border border-gray-200 border-l-0 px-3 flex items-center text-gray-600 hover:bg-gray-200 transition-colors"
                title={showSecret ? "Hide Secret Key" : "Show Secret Key"}
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <button
                onClick={() => handleCopy(credentials.secret_key)}
                className="bg-gray-100 border border-gray-200 border-l-0 rounded-r-lg px-4 flex items-center text-gray-600 hover:bg-gray-200 hover:text-indigo-600 transition-colors"
                title="Copy Secret Key"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-red-500 font-medium">Keep this secret! Pass this in the <code>x-secret-key</code> header. Never share it or expose it in frontend code.</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h3 className="font-semibold text-gray-900">Recent API Logs</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-gray-100">
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Time</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Endpoint</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">IP Address</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    No recent API requests found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 text-sm text-gray-500">
                      {format(new Date(log.created_at), 'dd MMM yyyy, hh:mm:ss a')}
                    </td>
                    <td className="px-6 py-3 text-sm font-mono text-gray-900">
                      {log.endpoint}
                    </td>
                    <td className="px-6 py-3 text-sm font-mono text-gray-500">
                      {log.request_ip || 'Unknown'}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        log.status_code >= 200 && log.status_code < 300
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {log.status_code}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
