import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ShieldCheck, Plus, Trash2, KeyRound, Copy, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import LoadingSpinner from './shared/LoadingSpinner';
import { useToast } from '../context/ToastContext';

interface B2BCredential {
  id: string;
  agent_id: string;
  api_key: string;
  secret_key: string;
  billavenue_agent_id: string;
  is_active: boolean;
  ip_whitelist: string[];
  created_at: string;
  users_profiles?: {
    first_name: string;
    last_name: string;
    mobile: string;
    email: string;
  };
}

export default function AdminB2BManagement() {
  const toast = useToast();
  const [credentials, setCredentials] = useState<B2BCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [agents, setAgents] = useState<{ id: string; first_name: string; last_name: string; mobile: string }[]>([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [billavenueAgentId, setBillavenueAgentId] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchCredentials();
    fetchAgents();
  }, []);

  const fetchCredentials = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('b2b_api_credentials')
      .select(`
        *,
        users_profiles (first_name, last_name, mobile, email)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load B2B credentials');
      console.error(error);
    } else {
      setCredentials(data || []);
    }
    setLoading(false);
  };

  const fetchAgents = async () => {
    const { data, error } = await supabase
      .from('users_profiles')
      .select('id, first_name, last_name, mobile')
      .in('role', ['retailer', 'distributor', 'super_distributor'])
      .order('first_name');

    if (!error && data) {
      setAgents(data);
    }
  };

  const generateApiKey = () => {
    return 'pk_live_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  };

  const generateSecretKey = () => {
    return 'sk_live_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  };

  const handleGenerateCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgent) {
      toast.error('Please select an agent');
      return;
    }

    setGenerating(true);
    const apiKey = generateApiKey();
    const secretKey = generateSecretKey();

    const { error } = await supabase
      .from('b2b_api_credentials')
      .insert({
        agent_id: selectedAgent,
        api_key: apiKey,
        secret_key: secretKey,
        billavenue_agent_id: billavenueAgentId || null,
        is_active: true
      });

    if (error) {
      if (error.code === '23505') {
        toast.error('This agent already has API credentials.');
      } else {
        toast.error('Failed to generate credentials');
      }
      console.error(error);
    } else {
      toast.success('API credentials generated successfully');
      setShowAddModal(false);
      setSelectedAgent('');
      setBillavenueAgentId('');
      fetchCredentials();
    }
    setGenerating(false);
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('b2b_api_credentials')
      .update({ is_active: !currentStatus, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      toast.error('Failed to update status');
    } else {
      toast.success(`API access ${!currentStatus ? 'enabled' : 'disabled'}`);
      setCredentials(credentials.map(c => c.id === id ? { ...c, is_active: !currentStatus } : c));
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to revoke and delete these API credentials? This action cannot be undone.')) return;

    const { error } = await supabase
      .from('b2b_api_credentials')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete credentials');
    } else {
      toast.success('API credentials revoked');
      setCredentials(credentials.filter(c => c.id !== id));
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <KeyRound className="h-6 w-6 text-indigo-600" />
            B2B API Management
          </h1>
          <p className="text-gray-500 mt-1">Manage API access for your resellers</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Generate New API Keys
        </button>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : credentials.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <KeyRound className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No API Credentials</h3>
          <p className="text-gray-500">Generate API keys to allow agents to integrate via API.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <AnimatePresence>
            {credentials.map((cred) => (
              <motion.div
                key={cred.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
              >
                <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {cred.users_profiles?.first_name} {cred.users_profiles?.last_name}
                    </h3>
                    <p className="text-sm text-gray-500">{cred.users_profiles?.mobile}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    cred.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {cred.is_active ? 'Active' : 'Disabled'}
                  </span>
                </div>
                
                <div className="p-5 space-y-4">
                  {cred.billavenue_agent_id && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">BillAvenue Agent ID</label>
                      <div className="mt-1 flex items-center justify-between bg-indigo-50 p-2 rounded border border-indigo-100">
                        <code className="text-sm text-indigo-800 font-mono font-semibold truncate mr-2">
                          {cred.billavenue_agent_id}
                        </code>
                        <button onClick={() => handleCopy(cred.billavenue_agent_id)} className="text-indigo-400 hover:text-indigo-600 shrink-0">
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">API Key</label>
                    <div className="mt-1 flex items-center justify-between bg-gray-50 p-2 rounded border border-gray-100">
                      <code className="text-sm text-gray-800 font-mono truncate mr-2">
                        {cred.api_key}
                      </code>
                      <button onClick={() => handleCopy(cred.api_key)} className="text-gray-400 hover:text-indigo-600 shrink-0">
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Secret Key</label>
                    <div className="mt-1 flex items-center justify-between bg-gray-50 p-2 rounded border border-gray-100">
                      <code className="text-sm text-gray-800 font-mono truncate mr-2">
                        ••••••••••••••••••••••••
                      </code>
                      <button onClick={() => handleCopy(cred.secret_key)} className="text-gray-400 hover:text-indigo-600 shrink-0" title="Copy Secret Key">
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-4 mt-4 border-t border-gray-100">
                    <button
                      onClick={() => toggleStatus(cred.id, cred.is_active)}
                      className={`text-sm font-medium ${cred.is_active ? 'text-amber-600 hover:text-amber-700' : 'text-green-600 hover:text-green-700'}`}
                    >
                      {cred.is_active ? 'Disable Access' : 'Enable Access'}
                    </button>
                    
                    <button
                      onClick={() => handleDelete(cred.id)}
                      className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50"
                      title="Revoke and Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Add Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Generate API Credentials</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleGenerateCredentials} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Agent</label>
                  <select
                    value={selectedAgent}
                    onChange={(e) => setSelectedAgent(e.target.value)}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    required
                  >
                    <option value="">-- Select an Agent --</option>
                    {agents.map(agent => (
                      <option key={agent.id} value={agent.id}>
                        {agent.first_name} {agent.last_name} ({agent.mobile})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assign BillAvenue Agent ID (Optional)</label>
                  <input
                    type="text"
                    value={billavenueAgentId}
                    onChange={(e) => setBillavenueAgentId(e.target.value)}
                    placeholder="e.g. CC01RS13AGTBBG162607"
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">If left blank, the global default Agent ID will be used.</p>
                </div>

                <div className="bg-amber-50 p-3 rounded-lg flex items-start gap-3 mt-4 text-amber-800 text-sm">
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <p>Generating new API keys will allow this user to access the BillAvenue B2B API programmatically. Their account balance will be deducted for any API transactions.</p>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={generating || !selectedAgent}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {generating ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      'Generate Keys'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
