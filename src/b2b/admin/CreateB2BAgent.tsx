import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { UserPlus, ArrowLeft, ShieldCheck, Edit, Trash2, Settings, KeyRound, Copy, RefreshCw, Edit3, Globe, Building2, CheckCircle2, X } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { motion } from 'motion/react';

type ViewState = 'list' | 'create' | 'edit';

interface Agent {
  id: string;
  first_name: string;
  last_name: string;
  mobile: string;
  address: string;
  b2b_login_id: string;
  wallet_balance: number;
  charge_per_bill: number;
  api_key?: string;
  secret_key?: string;
  ip_whitelist?: string[];
  domain_whitelist?: string[];
  billavenue_agent_id?: string;
  is_active?: boolean;
}

export default function CreateB2BAgent() {
  const navigate = useNavigate();
  const toast = useToast();
  
  const [view, setView] = useState<ViewState>('list');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedAgentForApi, setSelectedAgentForApi] = useState<Agent | null>(null);
  const [showIPModal, setShowIPModal] = useState(false);
  const [ipList, setIpList] = useState<string[]>([]);
  const [newIp, setNewIp] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showDomainModal, setShowDomainModal] = useState(false);
  const [domainList, setDomainList] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [showAgentIdModal, setShowAgentIdModal] = useState(false);
  const [billAvenueAgentId, setBillAvenueAgentId] = useState('');


  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    mobile: '',
    address: '',
    b2bLoginId: '',
    b2bPassword: '',
    chargePerBill: '0'
  });

  useEffect(() => {
    if (view === 'list') {
      fetchAgents();
    }
  }, [view]);

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('b2b_api_credentials')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAgents(data || []);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to fetch agents');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (agent: Agent) => {
    setEditingId(agent.id);
    setFormData({
      firstName: agent.first_name || '',
      lastName: agent.last_name || '',
      mobile: agent.mobile || '',
      address: agent.address || '',
      b2bLoginId: agent.b2b_login_id || '',
      b2bPassword: '', // keep empty by default, only update if typed
      chargePerBill: agent.charge_per_bill?.toString() || '0'
    });
    setView('edit');
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this agent?')) return;
    
    try {
      const { error } = await supabase
        .from('b2b_api_credentials')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Agent deleted successfully');
      fetchAgents();
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to delete agent');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };


  const toggleStatus = async (agent: Agent) => {
    const newStatus = !agent.is_active;
    const { error } = await supabase
      .from('b2b_api_credentials')
      .update({ is_active: newStatus })
      .eq('id', agent.id);

    if (!error) {
      toast.success(`API access ${newStatus ? 'enabled' : 'disabled'}`);
      setAgents(agents.map(a => a.id === agent.id ? { ...a, is_active: newStatus } : a));
      if (selectedAgentForApi?.id === agent.id) {
        setSelectedAgentForApi({ ...selectedAgentForApi, is_active: newStatus });
      }
    } else {
      toast.error('Failed to change status');
    }
  };

  const handleGenerateKeys = async (agent: Agent) => {
    if (!window.confirm('Are you sure you want to generate new API keys? If this agent was already using an old key, it will stop working immediately.')) {
      return;
    }

    const apiKey = 'pk_live_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const secretKey = 'sk_live_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    const { error } = await supabase
      .from('b2b_api_credentials')
      .update({ api_key: apiKey, secret_key: secretKey })
      .eq('id', agent.id);

    if (error) {
      toast.error('Failed to generate keys');
    } else {
      toast.success('API Keys generated successfully');
      setAgents(agents.map(a => a.id === agent.id ? { ...a, api_key: apiKey, secret_key: secretKey } : a));
      if (selectedAgentForApi?.id === agent.id) {
        setSelectedAgentForApi({ ...selectedAgentForApi, api_key: apiKey, secret_key: secretKey });
      }
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const openIpModal = (agent: Agent) => {
    setIpList(agent.ip_whitelist || []);
    setNewIp('');
    setShowIPModal(true);
  };

  const handleAddIp = () => {
    if (!newIp.trim()) return;
    if (ipList.includes(newIp.trim())) {
      toast.error('IP already in whitelist');
      return;
    }
    setIpList([...ipList, newIp.trim()]);
    setNewIp('');
  };

  const handleRemoveIp = (ip: string) => {
    setIpList(ipList.filter(i => i !== ip));
  };

  const saveIpWhitelist = async () => {
    if (!selectedAgentForApi) return;
    setIsSaving(true);
    const { error } = await supabase
      .from('b2b_api_credentials')
      .update({ ip_whitelist: ipList })
      .eq('id', selectedAgentForApi.id);

    if (error) {
      toast.error('Failed to update IP Whitelist');
    } else {
      toast.success('IP Whitelist updated successfully');
      setAgents(agents.map(a => a.id === selectedAgentForApi.id ? { ...a, ip_whitelist: ipList } : a));
      setSelectedAgentForApi({ ...selectedAgentForApi, ip_whitelist: ipList });
      setShowIPModal(false);
    }
    setIsSaving(false);
  };

  const openDomainModal = (agent: Agent) => {
    setDomainList(agent.domain_whitelist || []);
    setNewDomain('');
    setShowDomainModal(true);
  };

  const handleAddDomain = () => {
    if (!newDomain.trim()) return;
    if (domainList.includes(newDomain.trim())) {
      toast.error('Domain already in whitelist');
      return;
    }
    setDomainList([...domainList, newDomain.trim()]);
    setNewDomain('');
  };

  const handleRemoveDomain = (domain: string) => {
    setDomainList(domainList.filter(d => d !== domain));
  };

  const saveDomainWhitelist = async () => {
    if (!selectedAgentForApi) return;
    setIsSaving(true);
    const { error } = await supabase
      .from('b2b_api_credentials')
      .update({ domain_whitelist: domainList })
      .eq('id', selectedAgentForApi.id);

    if (error) {
      toast.error('Failed to update Domain Whitelist');
    } else {
      toast.success('Domain Whitelist updated successfully');
      setAgents(agents.map(a => a.id === selectedAgentForApi.id ? { ...a, domain_whitelist: domainList } : a));
      setSelectedAgentForApi({ ...selectedAgentForApi, domain_whitelist: domainList });
      setShowDomainModal(false);
    }
    setIsSaving(false);
  };

  const openAgentIdModal = (agent: Agent) => {
    setBillAvenueAgentId(agent.billavenue_agent_id || '');
    setShowAgentIdModal(true);
  };

  const saveAgentId = async () => {
    if (!selectedAgentForApi) return;
    setIsSaving(true);
    const { error } = await supabase
      .from('b2b_api_credentials')
      .update({ billavenue_agent_id: billAvenueAgentId })
      .eq('id', selectedAgentForApi.id);

    if (error) {
      toast.error('Failed to save BillAvenue Agent ID');
    } else {
      toast.success('BillAvenue Agent ID saved successfully');
      setAgents(agents.map(a => a.id === selectedAgentForApi.id ? { ...a, billavenue_agent_id: billAvenueAgentId } : a));
      setSelectedAgentForApi({ ...selectedAgentForApi, billavenue_agent_id: billAvenueAgentId });
      setShowAgentIdModal(false);
    }
    setIsSaving(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (view === 'create') {
        const { error: b2bError } = await supabase
          .from('b2b_api_credentials')
          .insert({
            first_name: formData.firstName,
            last_name: formData.lastName,
            mobile: formData.mobile,
            address: formData.address,
            b2b_login_id: formData.b2bLoginId,
            b2b_password: formData.b2bPassword,
            charge_per_bill: parseFloat(formData.chargePerBill) || 0,
            is_active: true
          });

        if (b2bError) {
          if (b2bError.code === '23505') {
            toast.error('This B2B Login ID is already taken.');
          } else {
            throw b2bError;
          }
          setLoading(false);
          return;
        }
        toast.success('B2B Agent successfully onboarded!');
      } else if (view === 'edit' && editingId) {
        const updates: any = {
          first_name: formData.firstName,
          last_name: formData.lastName,
          mobile: formData.mobile,
          address: formData.address,
          b2b_login_id: formData.b2bLoginId,
          charge_per_bill: parseFloat(formData.chargePerBill) || 0
        };
        
        if (formData.b2bPassword) {
          updates.b2b_password = formData.b2bPassword;
        }

        const { error: b2bError } = await supabase
          .from('b2b_api_credentials')
          .update(updates)
          .eq('id', editingId);

        if (b2bError) {
          if (b2bError.code === '23505') {
            toast.error('This B2B Login ID is already taken.');
          } else {
            throw b2bError;
          }
          setLoading(false);
          return;
        }
        toast.success('B2B Agent updated successfully!');
      }

      setFormData({
        firstName: '', lastName: '', mobile: '', address: '', b2bLoginId: '', b2bPassword: '', chargePerBill: '0'
      });
      setEditingId(null);
      setView('list');
      
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to process agent details');
    } finally {
      setLoading(false);
    }
  };

  const renderList = () => (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">B2B Agents</h2>
          <p className="text-gray-500 mt-1">Manage your onboarded B2B agents and their balances.</p>
        </div>
        <button
          onClick={() => {
            setFormData({ firstName: '', lastName: '', mobile: '', address: '', b2bLoginId: '', b2bPassword: '', chargePerBill: '0' });
            setView('create');
          }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <UserPlus size={18} />
          Create Agent
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                <th className="p-4">Agent Name</th>
                <th className="p-4">Login ID</th>
                <th className="p-4">Mobile</th>
                <th className="p-4 text-right">Charge (₹)</th>
                <th className="p-4 text-right">Wallet Balance</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    Loading agents...
                  </td>
                </tr>
              ) : agents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    No agents found. Click "Create Agent" to onboard one.
                  </td>
                </tr>
              ) : (
                agents.map((agent) => (
                  <tr key={agent.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 font-medium text-slate-900">
                      {agent.first_name} {agent.last_name}
                    </td>
                    <td className="p-4 text-slate-600">{agent.b2b_login_id}</td>
                    <td className="p-4 text-slate-600">{agent.mobile}</td>
                    <td className="p-4 text-right font-medium text-amber-600">
                      ₹{parseFloat(agent.charge_per_bill?.toString() || '0').toFixed(2)}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1 font-semibold text-emerald-600">
                        <span>₹</span>
                        <span>{parseFloat(agent.wallet_balance?.toString() || '0').toFixed(2)}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setSelectedAgentForApi(agent)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="API Settings"
                        >
                          <Settings size={18} />
                        </button>
                        <button
                          onClick={() => handleEditClick(agent)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Agent"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(agent.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Agent"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* API Settings Main Modal */}
      {selectedAgentForApi && (
        <div className="fixed inset-0 z-[40] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center sticky top-0 z-10">
              <div>
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Settings className="h-6 w-6 text-indigo-600" /> API Settings
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Manage API configuration for <span className="font-semibold text-gray-800">{selectedAgentForApi.first_name} {selectedAgentForApi.last_name}</span> (Login ID: {selectedAgentForApi.b2b_login_id})
                </p>
              </div>
              <div className="flex items-center gap-4">
                {/* Toggle switch for enable/disable */}
                <div className="flex items-center gap-2 mr-4 border-r border-gray-300 pr-4">
                  <span className="text-sm font-semibold text-gray-700">API Access:</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={!!selectedAgentForApi.is_active}
                      onChange={() => toggleStatus(selectedAgentForApi)}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                  </label>
                  <span className={`text-xs font-bold ${selectedAgentForApi.is_active ? 'text-green-600' : 'text-gray-500'}`}>
                    {selectedAgentForApi.is_active ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <button 
                  onClick={() => setSelectedAgentForApi(null)} 
                  className="p-2 bg-white rounded-full border border-gray-200 text-gray-500 hover:text-gray-900 transition-colors shadow-sm"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-8">
              {/* Credentials Section */}
              <div>
                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-indigo-500" /> API Credentials
                </h4>
                {selectedAgentForApi.api_key && selectedAgentForApi.secret_key ? (
                  <div className="space-y-4 bg-gray-50 p-5 rounded-xl border border-gray-200">
                    <div>
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">API Key</span>
                      <div className="flex items-center gap-2">
                        <code className="text-sm text-indigo-700 font-mono font-medium truncate block flex-1 bg-indigo-50 px-3 py-2 rounded border border-indigo-100">
                          {selectedAgentForApi.api_key}
                        </code>
                        <button onClick={() => handleCopy(selectedAgentForApi.api_key!)} className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors bg-white border border-gray-200">
                          <Copy className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">Secret Key</span>
                      <div className="flex items-center gap-2">
                        <code className="text-sm text-indigo-700 font-mono font-medium truncate block flex-1 bg-indigo-50 px-3 py-2 rounded border border-indigo-100">
                          ••••••••••••••••••••••••••••
                        </code>
                        <button onClick={() => handleCopy(selectedAgentForApi.secret_key!)} className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors bg-white border border-gray-200">
                          <Copy className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                    <div className="pt-2 flex justify-end">
                      <button 
                        onClick={() => handleGenerateKeys(selectedAgentForApi)}
                        className="text-sm font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100"
                      >
                        <RefreshCw className="h-4 w-4" /> Regenerate Keys
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 flex flex-col items-center justify-center gap-3">
                    <p className="text-sm text-amber-800 font-medium text-center">API Keys have not been generated for this agent yet.</p>
                    <button
                      onClick={() => handleGenerateKeys(selectedAgentForApi)}
                      className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-sm shadow-sm transition-colors"
                    >
                      Generate API Keys Now
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* IP Whitelist */}
                <div className="border border-gray-200 rounded-xl p-5 flex flex-col h-full bg-white shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-sm font-bold text-gray-700 uppercase tracking-widest flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-indigo-500" /> IPs
                    </h4>
                    <button onClick={() => openIpModal(selectedAgentForApi)} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 bg-indigo-50 px-2.5 py-1.5 rounded-md border border-indigo-100">
                      <Edit3 className="h-3.5 w-3.5" /> Manage
                    </button>
                  </div>
                  <div className="flex-1 flex flex-col gap-2">
                    {selectedAgentForApi.ip_whitelist && selectedAgentForApi.ip_whitelist.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedAgentForApi.ip_whitelist.map((ip: string) => (
                          <span key={ip} className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-mono border border-slate-200">
                            {ip}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-rose-500 font-medium bg-rose-50 p-3 rounded-lg text-center flex-1 flex items-center justify-center border border-rose-100">No IPs Whitelisted</p>
                    )}
                  </div>
                </div>

                {/* Domain Whitelist */}
                <div className="border border-gray-200 rounded-xl p-5 flex flex-col h-full bg-white shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-sm font-bold text-gray-700 uppercase tracking-widest flex items-center gap-2">
                      <Globe className="h-5 w-5 text-indigo-500" /> Domains
                    </h4>
                    <button onClick={() => openDomainModal(selectedAgentForApi)} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 bg-indigo-50 px-2.5 py-1.5 rounded-md border border-indigo-100">
                      <Edit3 className="h-3.5 w-3.5" /> Manage
                    </button>
                  </div>
                  <div className="flex-1 flex flex-col gap-2">
                    {selectedAgentForApi.domain_whitelist && selectedAgentForApi.domain_whitelist.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedAgentForApi.domain_whitelist.map((domain: string) => (
                          <span key={domain} className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-mono border border-slate-200">
                            {domain}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-rose-500 font-medium bg-rose-50 p-3 rounded-lg text-center flex-1 flex items-center justify-center border border-rose-100">No Domains Whitelisted</p>
                    )}
                  </div>
                </div>
              </div>

              {/* BillAvenue Mapping */}
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-5 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-sm font-bold text-sky-800 uppercase tracking-widest flex items-center gap-2">
                    <Building2 className="h-5 w-5" /> BillAvenue Mapping
                  </h4>
                  <button onClick={() => openAgentIdModal(selectedAgentForApi)} className="text-xs font-bold text-sky-700 hover:text-sky-800 flex items-center gap-1 bg-white px-3 py-1.5 rounded shadow-sm border border-sky-200">
                    <Edit3 className="h-3.5 w-3.5" /> Edit Agent ID
                  </button>
                </div>
                {selectedAgentForApi.billavenue_agent_id ? (
                  <div className="flex items-center gap-2 mt-2 bg-white p-3 rounded-lg border border-sky-200">
                    <CheckCircle2 className="h-5 w-5 text-sky-500" />
                    <span className="text-sm font-bold text-gray-800">Agent ID:</span>
                    <code className="text-sm text-sky-700 font-mono font-bold">{selectedAgentForApi.billavenue_agent_id}</code>
                  </div>
                ) : (
                  <p className="text-sm text-sky-600 font-medium mt-2 bg-white p-3 rounded-lg border border-sky-100">BillAvenue Agent ID not mapped yet. Needed for BBPS transactions.</p>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Manage IP Whitelist Modal */}
      {showIPModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden"
          >
            <div className="p-6 border-b border-gray-100 bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">Manage IP Whitelist</h3>
              <p className="text-sm text-gray-500 mt-1">Add IP addresses that are allowed to make API calls.</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newIp}
                  onChange={(e) => setNewIp(e.target.value)}
                  placeholder="e.g. 192.168.1.1"
                  className="flex-1 rounded-xl border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 border outline-none"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddIp()}
                />
                <button onClick={handleAddIp} className="bg-gray-900 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-gray-800">
                  Add IP
                </button>
              </div>
              <div className="bg-gray-50 rounded-xl border border-gray-200 min-h-[150px] p-3 flex flex-wrap gap-2 items-start content-start">
                {ipList.length === 0 ? (
                  <p className="text-sm text-gray-400 w-full text-center py-4">No IPs added yet.</p>
                ) : (
                  ipList.map(ip => (
                    <div key={ip} className="bg-white border border-gray-200 pl-3 pr-1 py-1 rounded-full flex items-center gap-2 text-sm font-mono shadow-sm">
                      {ip}
                      <button onClick={() => handleRemoveIp(ip)} className="text-gray-400 hover:text-red-500 bg-gray-50 hover:bg-red-50 p-1 rounded-full">
                        &times;
                      </button>
                    </div>
                  ))
                )}
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button onClick={() => setShowIPModal(false)} className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-xl font-bold">
                  Cancel
                </button>
                <button onClick={saveIpWhitelist} disabled={isSaving} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold disabled:opacity-50 flex items-center gap-2">
                  {isSaving ? <RefreshCw className="h-5 w-5 animate-spin" /> : 'Save Whitelist'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Manage Domain Whitelist Modal */}
      {showDomainModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden"
          >
            <div className="p-6 border-b border-gray-100 bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">Manage Domain Whitelist</h3>
              <p className="text-sm text-gray-500 mt-1">Add domains that are allowed to make API calls.</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  placeholder="e.g. agent-portal.com"
                  className="flex-1 rounded-xl border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 border outline-none"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
                />
                <button onClick={handleAddDomain} className="bg-gray-900 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-gray-800">
                  Add Domain
                </button>
              </div>
              <div className="bg-gray-50 rounded-xl border border-gray-200 min-h-[150px] p-3 flex flex-wrap gap-2 items-start content-start">
                {domainList.length === 0 ? (
                  <p className="text-sm text-gray-400 w-full text-center py-4">No domains added yet.</p>
                ) : (
                  domainList.map(domain => (
                    <div key={domain} className="bg-white border border-gray-200 pl-3 pr-1 py-1 rounded-full flex items-center gap-2 text-sm font-mono shadow-sm">
                      {domain}
                      <button onClick={() => handleRemoveDomain(domain)} className="text-gray-400 hover:text-red-500 bg-gray-50 hover:bg-red-50 p-1 rounded-full">
                        &times;
                      </button>
                    </div>
                  ))
                )}
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button onClick={() => setShowDomainModal(false)} className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-xl font-bold">
                  Cancel
                </button>
                <button onClick={saveDomainWhitelist} disabled={isSaving} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold disabled:opacity-50 flex items-center gap-2">
                  {isSaving ? <RefreshCw className="h-5 w-5 animate-spin" /> : 'Save Domains'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Manage BillAvenue Agent ID Modal */}
      {showAgentIdModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden"
          >
            <div className="p-6 border-b border-gray-100 bg-sky-50">
              <h3 className="text-lg font-bold text-gray-900">Map BillAvenue Agent ID</h3>
              <p className="text-sm text-gray-600 mt-1">Enter the official BillAvenue Agent ID provided by BillAvenue for this reseller.</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">BillAvenue Agent ID</label>
                <input
                  type="text"
                  value={billAvenueAgentId}
                  onChange={(e) => setBillAvenueAgentId(e.target.value)}
                  placeholder="e.g. AG123456"
                  className="w-full rounded-xl border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border font-mono outline-none"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && saveAgentId()}
                />
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <button onClick={() => setShowAgentIdModal(false)} className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-xl font-bold">
                  Cancel
                </button>
                <button onClick={saveAgentId} disabled={isSaving} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold disabled:opacity-50 flex items-center gap-2">
                  {isSaving ? <RefreshCw className="h-5 w-5 animate-spin" /> : 'Save Agent ID'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );

  const renderForm = () => (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => setView('list')}
          className="p-2 bg-white rounded-lg border border-gray-200 text-gray-500 hover:text-gray-900 transition-colors shadow-sm"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {view === 'create' ? 'Onboard New B2B Agent' : 'Edit B2B Agent'}
          </h2>
          <p className="text-gray-500 mt-1">
            {view === 'create' ? 'Register basic details to create a new B2B agent profile.' : 'Update agent details.'}
          </p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden"
      >
        <div className="p-6 border-b border-gray-100 bg-gray-50 flex items-center gap-3">
          <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h3 className="font-semibold text-gray-900">Agent Details Form</h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-8">
          
          <div>
            <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">
              1. Basic Profile Details
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                  placeholder="Enter first name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                  placeholder="Enter last name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                <input
                  type="tel"
                  name="mobile"
                  value={formData.mobile}
                  onChange={handleChange}
                  required
                  pattern="[0-9]{10}"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                  placeholder="10-digit mobile number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Charge per Bill (₹)</label>
                <input
                  type="number"
                  name="chargePerBill"
                  value={formData.chargePerBill}
                  onChange={handleChange}
                  required
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-mono"
                  placeholder="e.g. 10"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Address</label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all resize-none"
                  placeholder="Enter complete address"
                />
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">
              2. B2B Login Credentials
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">B2B Login ID</label>
                <input
                  type="text"
                  name="b2bLoginId"
                  value={formData.b2bLoginId}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all bg-gray-50 font-mono"
                  placeholder="e.g., agent_123"
                />
                <p className="text-xs text-gray-500 mt-1">Must be unique across the platform.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  B2B Password {view === 'edit' && <span className="text-xs font-normal text-gray-500">(Leave blank to keep current)</span>}
                </label>
                <input
                  type="text"
                  name="b2bPassword"
                  value={formData.b2bPassword}
                  onChange={handleChange}
                  required={view === 'create'}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-mono"
                  placeholder={view === 'edit' ? "Enter new password" : "Enter a secure password"}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setView('list')}
              className="px-6 py-2.5 rounded-xl font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <UserPlus className="h-5 w-5" />
              )}
              {view === 'create' ? 'Complete Registration' : 'Update Agent'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );

  return view === 'list' ? renderList() : renderForm();
}
