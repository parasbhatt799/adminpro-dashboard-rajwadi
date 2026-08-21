import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { UserPlus, ArrowLeft, ShieldCheck, Edit, Trash2, Settings, KeyRound, Copy, RefreshCw, Edit3, Globe, Building2, CheckCircle2, X, Search, Camera, User } from 'lucide-react';
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
  developer_charge?: number;
  owner_charge?: number;
  fixed_deposit_amount?: number;
  agent_tag?: string;
  api_key?: string;
  secret_key?: string;
  ip_whitelist?: string[];
  domain_whitelist?: string[];
  billavenue_agent_id?: string;
  is_active?: boolean;
  profile_photo_url?: string;
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
  const [agentSearchTerm, setAgentSearchTerm] = useState('');

  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    mobile: '',
    address: '',
    b2bLoginId: '',
    b2bPassword: '',
    chargePerBill: '0',
    developerCharge: '0',
    ownerCharge: '0',
    fixedDepositAmount: '0',
    agentTag: ''
  });

  const handleDeveloperChargeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const devVal = e.target.value;
    const total = parseFloat(formData.chargePerBill) || 0;
    const devNum = parseFloat(devVal) || 0;
    const ownerCalc = Math.max(0, total - devNum);
    setFormData(prev => ({
      ...prev,
      developerCharge: devVal,
      ownerCharge: ownerCalc.toString()
    }));
  };

  const handleOwnerChargeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const ownerVal = e.target.value;
    const total = parseFloat(formData.chargePerBill) || 0;
    const ownerNum = parseFloat(ownerVal) || 0;
    const devCalc = Math.max(0, total - ownerNum);
    setFormData(prev => ({
      ...prev,
      ownerCharge: ownerVal,
      developerCharge: devCalc.toString()
    }));
  };

  const handleTotalChargeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const totalVal = e.target.value;
    const totalNum = parseFloat(totalVal) || 0;
    const devNum = parseFloat(formData.developerCharge) || 0;
    const ownerCalc = Math.max(0, totalNum - devNum);
    setFormData(prev => ({
      ...prev,
      chargePerBill: totalVal,
      ownerCharge: ownerCalc.toString()
    }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfilePhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (view === 'list') {
      fetchAgents();
    }
  }, [view]);

  const fetchAgents = async () => {
    setLoading(true);
    try {
      let allAgents: Agent[] = [];
      let from = 0;
      const step = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('b2b_api_credentials')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, from + step - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allAgents = allAgents.concat(data as Agent[]);
          if (data.length < step) {
            hasMore = false;
          } else {
            from += step;
          }
        } else {
          hasMore = false;
        }
      }

      setAgents(allAgents);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to fetch agents');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (agent: Agent) => {
    setEditingId(agent.id);
    setPhotoPreview(agent.profile_photo_url || null);
    setProfilePhoto(null);
    setFormData({
      firstName: agent.first_name || '',
      lastName: agent.last_name || '',
      mobile: agent.mobile || '',
      address: agent.address || '',
      b2bLoginId: agent.b2b_login_id || '',
      b2bPassword: '', // keep empty by default, only update if typed
      chargePerBill: agent.charge_per_bill !== null && agent.charge_per_bill !== undefined ? agent.charge_per_bill.toString() : '',
      developerCharge: agent.developer_charge !== null && agent.developer_charge !== undefined ? agent.developer_charge.toString() : '0',
      ownerCharge: agent.owner_charge !== null && agent.owner_charge !== undefined ? agent.owner_charge.toString() : '0',
      fixedDepositAmount: agent.fixed_deposit_amount !== null && agent.fixed_deposit_amount !== undefined ? agent.fixed_deposit_amount.toString() : '0',
      agentTag: agent.agent_tag || ''
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
      let uploadedPhotoUrl = photoPreview;

      if (profilePhoto) {
        const fileExt = profilePhoto.name.split('.').pop();
        const fileName = `b2b_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('profiles')
          .upload(filePath, profilePhoto);

        if (uploadError) {
          console.error("Upload photo error:", uploadError);
          toast.error("Failed to upload profile photo");
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('profiles')
            .getPublicUrl(filePath);
          uploadedPhotoUrl = publicUrl;
        }
      }

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
            charge_per_bill: formData.chargePerBill === '' ? null : (parseFloat(formData.chargePerBill) || 0),
            developer_charge: parseFloat(formData.developerCharge) || 0,
            owner_charge: parseFloat(formData.ownerCharge) || 0,
            fixed_deposit_amount: parseFloat(formData.fixedDepositAmount) || 0,
            agent_tag: formData.agentTag ? formData.agentTag.trim() : null,
            profile_photo_url: uploadedPhotoUrl || null,
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
          charge_per_bill: formData.chargePerBill === '' ? null : (parseFloat(formData.chargePerBill) || 0),
          developer_charge: parseFloat(formData.developerCharge) || 0,
          owner_charge: parseFloat(formData.ownerCharge) || 0,
          fixed_deposit_amount: parseFloat(formData.fixedDepositAmount) || 0,
          agent_tag: formData.agentTag ? formData.agentTag.trim() : null,
          profile_photo_url: uploadedPhotoUrl || null
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
        firstName: '', lastName: '', mobile: '', address: '', b2bLoginId: '', b2bPassword: '', chargePerBill: '', developerCharge: '0', ownerCharge: '0', fixedDepositAmount: '0', agentTag: ''
      });
      setProfilePhoto(null);
      setPhotoPreview(null);
      setEditingId(null);
      setView('list');
      
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to process agent details');
    } finally {
      setLoading(false);
    }
  };

  const filteredAgents = agents.filter((agent) => {
    if (!agentSearchTerm.trim()) return true;
    const term = agentSearchTerm.toLowerCase();
    const fullName = `${agent.first_name || ''} ${agent.last_name || ''}`.toLowerCase();
    const loginId = (agent.b2b_login_id || '').toLowerCase();
    const mobile = (agent.mobile || '').toLowerCase();
    const charge = agent.charge_per_bill !== null && agent.charge_per_bill !== undefined ? agent.charge_per_bill.toString() : 'global';
    const tag = (agent.agent_tag || '').toLowerCase();
    const baId = (agent.billavenue_agent_id || '').toLowerCase();

    return fullName.includes(term) || loginId.includes(term) || mobile.includes(term) || charge.includes(term) || tag.includes(term) || baId.includes(term);
  });

  const renderList = () => (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">B2B Agents</h2>
          <p className="text-slate-400 mt-1">Manage your onboarded B2B agents and their balances & charges.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <input
              type="text"
              placeholder="Search agent, login ID, charge..."
              value={agentSearchTerm}
              onChange={(e) => setAgentSearchTerm(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 pl-9 pr-8 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            {agentSearchTerm && (
              <button
                onClick={() => setAgentSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            onClick={() => {
              setFormData({ firstName: '', lastName: '', mobile: '', address: '', b2bLoginId: '', b2bPassword: '', chargePerBill: '', developerCharge: '0', ownerCharge: '0', fixedDepositAmount: '0', agentTag: '' });
              setView('create');
            }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-sm whitespace-nowrap"
          >
            <UserPlus size={18} />
            Create Agent
          </button>
        </div>
      </div>

      <div className="bg-slate-800 rounded-2xl shadow-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/50 border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wider font-bold">
                <th className="p-4">Agent Name</th>
                <th className="p-4">Login ID</th>
                <th className="p-4">Agent Tag / Portal</th>
                <th className="p-4">Mobile</th>
                <th className="p-4 text-right">Charge (₹)</th>
                <th className="p-4 text-right">Wallet Balance</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    Loading agents...
                  </td>
                </tr>
              ) : filteredAgents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    {agentSearchTerm ? 'No agents match your search criteria.' : 'No agents found. Click "Create Agent" to onboard one.'}
                  </td>
                </tr>
              ) : (
                filteredAgents.map((agent) => (
                  <tr key={agent.id} className="hover:bg-slate-700/20 transition-colors">
                    <td className="p-4 font-bold text-white">
                      <div className="flex items-center gap-3">
                        {agent.profile_photo_url ? (
                          <img
                            src={agent.profile_photo_url}
                            alt={`${agent.first_name} ${agent.last_name}`}
                            className="w-9 h-9 rounded-full object-cover border border-slate-700 shadow-sm shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center text-xs font-bold shrink-0">
                            {agent.first_name?.[0]?.toUpperCase() || ''}{agent.last_name?.[0]?.toUpperCase() || <User size={16} />}
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-white text-sm">{agent.first_name} {agent.last_name}</div>
                          {agent.billavenue_agent_id ? (
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-[10px] text-emerald-400 font-mono font-semibold bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded" title="BillAvenue Mapping Agent ID">
                                {agent.billavenue_agent_id}
                              </span>
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-500 font-mono italic mt-0.5">
                              No BillAvenue ID
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-indigo-300 font-mono text-xs">{agent.b2b_login_id}</td>
                    <td className="p-4">
                      {agent.agent_tag ? (
                        <span className="bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2.5 py-1 rounded-lg text-xs font-bold font-mono">
                          {agent.agent_tag}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-xs">-</span>
                      )}
                    </td>
                    <td className="p-4 text-slate-400 font-mono text-xs">{agent.mobile}</td>
                    <td className="p-4 text-right font-medium text-amber-400">
                      {agent.charge_per_bill !== null && agent.charge_per_bill !== undefined ? (
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-bold text-amber-400">₹{parseFloat(agent.charge_per_bill.toString()).toFixed(2)}</span>
                          <div className="flex items-center gap-1 text-[10px] font-mono">
                            <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded" title="Developer Charge">
                              Dev: ₹{parseFloat(agent.developer_charge?.toString() || '0').toFixed(2)}
                            </span>
                            <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-1.5 py-0.5 rounded" title="Owner Charge">
                              Owner: ₹{parseFloat(agent.owner_charge?.toString() || '0').toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded">Global</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center justify-end gap-1 font-bold text-emerald-400">
                          <span>₹</span>
                          <span>{parseFloat(agent.wallet_balance?.toString() || '0').toFixed(2)}</span>
                        </div>
                        {agent.fixed_deposit_amount && parseFloat(agent.fixed_deposit_amount.toString()) > 0 ? (
                          <span className="text-[10px] text-amber-400 font-mono font-semibold bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded" title="Frozen Security Deposit Balance">
                            🔒 Deposit: ₹{parseFloat(agent.fixed_deposit_amount.toString()).toFixed(2)}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setSelectedAgentForApi(agent)}
                          className="p-2 text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"
                          title="API Settings"
                        >
                          <Settings size={18} />
                        </button>
                        <button
                          onClick={() => handleEditClick(agent)}
                          className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                          title="Edit Agent"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(agent.id)}
                          className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
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
        <div className="fixed inset-0 z-[40] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto text-slate-200"
          >
            <div className="p-6 border-b border-slate-700 bg-slate-900/80 flex justify-between items-center sticky top-0 z-10">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Settings className="h-6 w-6 text-indigo-400" /> API Settings
                </h3>
                <p className="text-sm text-slate-400 mt-1">
                  Manage API configuration for <span className="font-semibold text-white">{selectedAgentForApi.first_name} {selectedAgentForApi.last_name}</span> (Login ID: <span className="font-mono text-indigo-300">{selectedAgentForApi.b2b_login_id}</span>)
                </p>
              </div>
              <div className="flex items-center gap-4">
                {/* Toggle switch for enable/disable */}
                <div className="flex items-center gap-2 mr-4 border-r border-slate-700 pr-4">
                  <span className="text-sm font-semibold text-slate-300">API Access:</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={!!selectedAgentForApi.is_active}
                      onChange={() => toggleStatus(selectedAgentForApi)}
                    />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                  <span className={`text-xs font-bold ${selectedAgentForApi.is_active ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {selectedAgentForApi.is_active ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <button 
                  onClick={() => setSelectedAgentForApi(null)} 
                  className="p-2 bg-slate-900 rounded-full border border-slate-700 text-slate-400 hover:text-white transition-colors shadow-sm"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-8">
              {/* Credentials Section */}
              <div>
                <h4 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-indigo-400" /> API Credentials
                </h4>
                {selectedAgentForApi.api_key && selectedAgentForApi.secret_key ? (
                  <div className="space-y-4 bg-slate-900/60 p-5 rounded-xl border border-slate-700">
                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">API Key</span>
                      <div className="flex items-center gap-2">
                        <code className="text-sm text-indigo-300 font-mono font-medium truncate block flex-1 bg-slate-900 px-3 py-2 rounded border border-slate-700">
                          {selectedAgentForApi.api_key}
                        </code>
                        <button onClick={() => handleCopy(selectedAgentForApi.api_key!)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors bg-slate-900 border border-slate-700">
                          <Copy className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">Secret Key</span>
                      <div className="flex items-center gap-2">
                        <code className="text-sm text-indigo-300 font-mono font-medium truncate block flex-1 bg-slate-900 px-3 py-2 rounded border border-slate-700">
                          ••••••••••••••••••••••••••••
                        </code>
                        <button onClick={() => handleCopy(selectedAgentForApi.secret_key!)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors bg-slate-900 border border-slate-700">
                          <Copy className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                    <div className="pt-2 flex justify-end">
                      <button 
                        onClick={() => handleGenerateKeys(selectedAgentForApi)}
                        className="text-sm font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20"
                      >
                        <RefreshCw className="h-4 w-4" /> Regenerate Keys
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-950/30 border border-amber-500/20 rounded-xl p-6 flex flex-col items-center justify-center gap-3">
                    <p className="text-sm text-amber-300 font-medium text-center">API Keys have not been generated for this agent yet.</p>
                    <button
                      onClick={() => handleGenerateKeys(selectedAgentForApi)}
                      className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-sm shadow-sm transition-colors"
                    >
                      Generate API Keys Now
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* IP Whitelist */}
                <div className="border border-slate-700 rounded-xl p-5 flex flex-col h-full bg-slate-900/40 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-sm font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-indigo-400" /> IPs
                    </h4>
                    <button onClick={() => openIpModal(selectedAgentForApi)} className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 bg-indigo-500/10 px-2.5 py-1.5 rounded-md border border-indigo-500/20">
                      <Edit3 className="h-3.5 w-3.5" /> Manage
                    </button>
                  </div>
                  <div className="flex-1 flex flex-col gap-2">
                    {selectedAgentForApi.ip_whitelist && selectedAgentForApi.ip_whitelist.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedAgentForApi.ip_whitelist.map((ip: string) => (
                          <span key={ip} className="px-2.5 py-1 bg-slate-900 text-slate-300 rounded-md text-xs font-mono border border-slate-700">
                            {ip}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-rose-400 font-medium bg-rose-500/10 p-3 rounded-lg text-center flex-1 flex items-center justify-center border border-rose-500/20">No IPs Whitelisted</p>
                    )}
                  </div>
                </div>

                {/* Domain Whitelist */}
                <div className="border border-slate-700 rounded-xl p-5 flex flex-col h-full bg-slate-900/40 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-sm font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                      <Globe className="h-5 w-5 text-indigo-400" /> Domains
                    </h4>
                    <button onClick={() => openDomainModal(selectedAgentForApi)} className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 bg-indigo-500/10 px-2.5 py-1.5 rounded-md border border-indigo-500/20">
                      <Edit3 className="h-3.5 w-3.5" /> Manage
                    </button>
                  </div>
                  <div className="flex-1 flex flex-col gap-2">
                    {selectedAgentForApi.domain_whitelist && selectedAgentForApi.domain_whitelist.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedAgentForApi.domain_whitelist.map((domain: string) => (
                          <span key={domain} className="px-2.5 py-1 bg-slate-900 text-slate-300 rounded-md text-xs font-mono border border-slate-700">
                            {domain}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-rose-400 font-medium bg-rose-500/10 p-3 rounded-lg text-center flex-1 flex items-center justify-center border border-rose-500/20">No Domains Whitelisted</p>
                    )}
                  </div>
                </div>
              </div>

              {/* BillAvenue Mapping */}
              <div className="bg-sky-950/30 border border-sky-500/20 rounded-xl p-5 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-sm font-bold text-sky-400 uppercase tracking-widest flex items-center gap-2">
                    <Building2 className="h-5 w-5" /> BillAvenue Mapping
                  </h4>
                  <button onClick={() => openAgentIdModal(selectedAgentForApi)} className="text-xs font-bold text-sky-300 hover:text-white flex items-center gap-1 bg-slate-900 px-3 py-1.5 rounded shadow-sm border border-sky-500/30">
                    <Edit3 className="h-3.5 w-3.5" /> Edit Agent ID
                  </button>
                </div>
                {selectedAgentForApi.billavenue_agent_id ? (
                  <div className="flex items-center gap-2 mt-2 bg-slate-900 p-3 rounded-lg border border-sky-500/30">
                    <CheckCircle2 className="h-5 w-5 text-sky-400" />
                    <span className="text-sm font-bold text-slate-300">Agent ID:</span>
                    <code className="text-sm text-sky-400 font-mono font-bold">{selectedAgentForApi.billavenue_agent_id}</code>
                  </div>
                ) : (
                  <p className="text-sm text-sky-400 font-medium mt-2 bg-slate-900 p-3 rounded-lg border border-sky-500/20">BillAvenue Agent ID not mapped yet. Needed for BBPS transactions.</p>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Manage IP Whitelist Modal */}
      {showIPModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden text-slate-200"
          >
            <div className="p-6 border-b border-slate-700 bg-slate-900/80">
              <h3 className="text-lg font-bold text-white">Manage IP Whitelist</h3>
              <p className="text-sm text-slate-400 mt-1">Add IP addresses that are allowed to make API calls.</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newIp}
                  onChange={(e) => setNewIp(e.target.value)}
                  placeholder="e.g. 192.168.1.1"
                  className="flex-1 rounded-xl bg-slate-900 border-slate-700 text-white placeholder-slate-500 p-2.5 border outline-none font-mono focus:border-indigo-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddIp()}
                />
                <button onClick={handleAddIp} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-medium transition-colors">
                  Add IP
                </button>
              </div>
              <div className="bg-slate-900 rounded-xl border border-slate-700 min-h-[150px] p-3 flex flex-wrap gap-2 items-start content-start">
                {ipList.length === 0 ? (
                  <p className="text-sm text-slate-500 w-full text-center py-4">No IPs added yet.</p>
                ) : (
                  ipList.map(ip => (
                    <div key={ip} className="bg-slate-800 border border-slate-700 text-slate-200 pl-3 pr-1 py-1 rounded-full flex items-center gap-2 text-sm font-mono shadow-sm">
                      {ip}
                      <button onClick={() => handleRemoveIp(ip)} className="text-slate-400 hover:text-rose-400 bg-slate-900 hover:bg-rose-500/20 p-1 rounded-full transition-colors">
                        &times;
                      </button>
                    </div>
                  ))
                )}
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button onClick={() => setShowIPModal(false)} className="px-5 py-2.5 text-slate-300 bg-slate-900 border border-slate-700 hover:bg-slate-700 rounded-xl font-bold transition-colors">
                  Cancel
                </button>
                <button onClick={saveIpWhitelist} disabled={isSaving} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold disabled:opacity-50 flex items-center gap-2 transition-colors">
                  {isSaving ? <RefreshCw className="h-5 w-5 animate-spin" /> : 'Save Whitelist'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Manage Domain Whitelist Modal */}
      {showDomainModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden text-slate-200"
          >
            <div className="p-6 border-b border-slate-700 bg-slate-900/80">
              <h3 className="text-lg font-bold text-white">Manage Domain Whitelist</h3>
              <p className="text-sm text-slate-400 mt-1">Add domains that are allowed to make API calls.</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  placeholder="e.g. agent-portal.com"
                  className="flex-1 rounded-xl bg-slate-900 border-slate-700 text-white placeholder-slate-500 p-2.5 border outline-none font-mono focus:border-indigo-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
                />
                <button onClick={handleAddDomain} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-medium transition-colors">
                  Add Domain
                </button>
              </div>
              <div className="bg-slate-900 rounded-xl border border-slate-700 min-h-[150px] p-3 flex flex-wrap gap-2 items-start content-start">
                {domainList.length === 0 ? (
                  <p className="text-sm text-slate-500 w-full text-center py-4">No domains added yet.</p>
                ) : (
                  domainList.map(domain => (
                    <div key={domain} className="bg-slate-800 border border-slate-700 text-slate-200 pl-3 pr-1 py-1 rounded-full flex items-center gap-2 text-sm font-mono shadow-sm">
                      {domain}
                      <button onClick={() => handleRemoveDomain(domain)} className="text-slate-400 hover:text-rose-400 bg-slate-900 hover:bg-rose-500/20 p-1 rounded-full transition-colors">
                        &times;
                      </button>
                    </div>
                  ))
                )}
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button onClick={() => setShowDomainModal(false)} className="px-5 py-2.5 text-slate-300 bg-slate-900 border border-slate-700 hover:bg-slate-700 rounded-xl font-bold transition-colors">
                  Cancel
                </button>
                <button onClick={saveDomainWhitelist} disabled={isSaving} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold disabled:opacity-50 flex items-center gap-2 transition-colors">
                  {isSaving ? <RefreshCw className="h-5 w-5 animate-spin" /> : 'Save Domains'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Manage BillAvenue Agent ID Modal */}
      {showAgentIdModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden text-slate-200"
          >
            <div className="p-6 border-b border-slate-700 bg-sky-950/40">
              <h3 className="text-lg font-bold text-white">Map BillAvenue Agent ID</h3>
              <p className="text-sm text-sky-400 mt-1">Enter the official BillAvenue Agent ID provided by BillAvenue for this reseller.</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">BillAvenue Agent ID</label>
                <input
                  type="text"
                  value={billAvenueAgentId}
                  onChange={(e) => setBillAvenueAgentId(e.target.value)}
                  placeholder="e.g. AG123456"
                  className="w-full rounded-xl bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500 p-3 border font-mono outline-none"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && saveAgentId()}
                />
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <button onClick={() => setShowAgentIdModal(false)} className="px-5 py-2.5 text-slate-300 bg-slate-900 border border-slate-700 hover:bg-slate-700 rounded-xl font-bold transition-colors">
                  Cancel
                </button>
                <button onClick={saveAgentId} disabled={isSaving} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold disabled:opacity-50 flex items-center gap-2 transition-colors">
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
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => setView('list')}
          className="p-2 bg-slate-800 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors shadow-sm"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-white">
            {view === 'create' ? 'Onboard New B2B Agent' : 'Edit B2B Agent'}
          </h2>
          <p className="text-slate-400 mt-1">
            {view === 'create' ? 'Register basic details to create a new B2B agent profile.' : 'Update agent details.'}
          </p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-800 rounded-2xl shadow-xl border border-slate-700 overflow-hidden"
      >
        <div className="p-6 border-b border-slate-700 bg-slate-900/50 flex items-center gap-3">
          <div className="bg-indigo-500/10 p-2 rounded-lg text-indigo-400 border border-indigo-500/20">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h3 className="font-semibold text-white">Agent Details Form</h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-8">
          
          <div>
            <h4 className="text-sm font-bold text-indigo-400 uppercase tracking-wider mb-4 border-b border-slate-700 pb-2">
              1. Basic Profile Details
            </h4>
            
            {/* Profile Photo Upload */}
            <div className="flex flex-col sm:flex-row items-center gap-6 mb-6 pb-6 border-b border-slate-700/60">
              <div className="relative w-24 h-24 group">
                <label className="w-full h-full bg-slate-900 rounded-full border-2 border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-400 overflow-hidden cursor-pointer hover:border-indigo-500 hover:text-indigo-400 transition-all shadow-inner">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Agent Preview" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <Camera size={24} />
                      <span className="text-[9px] font-bold uppercase mt-1">Photo</span>
                    </>
                  )}
                  <input
                    type="file"
                    className="sr-only"
                    accept="image/*"
                    onChange={handlePhotoChange}
                  />
                </label>
                {photoPreview && (
                  <button
                    type="button"
                    onClick={() => { setProfilePhoto(null); setPhotoPreview(null); }}
                    className="absolute -top-1 -right-1 bg-rose-500 text-white p-1 rounded-full shadow-lg hover:bg-rose-600 transition-colors"
                    title="Remove Photo"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <div className="text-center sm:text-left">
                <h5 className="text-sm font-semibold text-white">Profile Photo</h5>
                <p className="text-xs text-slate-400 mt-1">Upload a square photo for the B2B agent. Click the circle to choose an image.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">First Name</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                  placeholder="Enter first name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Last Name</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                  placeholder="Enter last name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Mobile Number</label>
                <input
                  type="tel"
                  name="mobile"
                  value={formData.mobile}
                  onChange={handleChange}
                  required
                  pattern="[0-9]{10}"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-mono"
                  placeholder="10-digit mobile number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Total Charge per Bill (₹)</label>
                <input
                  type="number"
                  name="chargePerBill"
                  value={formData.chargePerBill}
                  onChange={handleTotalChargeChange}
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-amber-400 font-bold placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-mono text-base"
                  placeholder="e.g. 10.00"
                />
                <p className="text-xs text-slate-400 mt-1">Total charge deducted from agent wallet per bill.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-amber-300 mb-1 flex items-center justify-between">
                  <span>Fix Security Deposit Amount (₹)</span>
                  <span className="text-[11px] text-amber-400/80 font-normal">Frozen from wallet</span>
                </label>
                <input
                  type="number"
                  name="fixedDepositAmount"
                  value={formData.fixedDepositAmount}
                  onChange={handleChange}
                  min="0"
                  step="100"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-amber-500/40 text-amber-400 font-bold placeholder-slate-500 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all font-mono text-base"
                  placeholder="e.g. 5000"
                />
                <p className="text-xs text-slate-400 mt-1">Deposit amount frozen from wallet. Usable balance = Wallet - Deposit. Set to 0 to unfreeze.</p>
              </div>

              {/* Developer & Owner Charge Split */}
              <div className="md:col-span-2 bg-slate-900/60 p-4 rounded-xl border border-slate-700/70 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-blue-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>Developer Charge (₹)</span>
                    <span className="text-[10px] text-slate-400 font-normal">Internal Admin Only</span>
                  </label>
                  <input
                    type="number"
                    name="developerCharge"
                    value={formData.developerCharge}
                    onChange={handleDeveloperChargeChange}
                    min="0"
                    step="0.01"
                    className="w-full px-3.5 py-2 rounded-lg bg-slate-900 border border-blue-500/30 text-blue-300 font-bold placeholder-slate-500 focus:border-blue-500 outline-none transition-all font-mono"
                    placeholder="0.00"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Developer revenue portion per bill.</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-purple-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>Owner Charge (₹)</span>
                    <span className="text-[10px] text-slate-400 font-normal">Internal Admin Only</span>
                  </label>
                  <input
                    type="number"
                    name="ownerCharge"
                    value={formData.ownerCharge}
                    onChange={handleOwnerChargeChange}
                    min="0"
                    step="0.01"
                    className="w-full px-3.5 py-2 rounded-lg bg-slate-900 border border-purple-500/30 text-purple-300 font-bold placeholder-slate-500 focus:border-purple-500 outline-none transition-all font-mono"
                    placeholder="0.00"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Owner revenue portion per bill.</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1 flex items-center justify-between">
                  <span>Agent Tag (Portal Name)</span>
                  <span className="text-[11px] text-slate-400">e.g. Rajwadi, Zentopay</span>
                </label>
                <input
                  type="text"
                  name="agentTag"
                  value={formData.agentTag}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-indigo-300 font-bold placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-mono"
                  placeholder="Portal Tag (e.g. Rajwadi, Zentopay)"
                />
                <p className="text-xs text-slate-400 mt-1">Identifies which portal this agent belongs to in Fund Requests.</p>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-1">Full Address</label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all resize-none"
                  placeholder="Enter complete address"
                />
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-bold text-indigo-400 uppercase tracking-wider mb-4 border-b border-slate-700 pb-2">
              2. B2B Login Credentials
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">B2B Login ID</label>
                <input
                  type="text"
                  name="b2bLoginId"
                  value={formData.b2bLoginId}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-mono"
                  placeholder="e.g., agent_123"
                />
                <p className="text-xs text-slate-400 mt-1">Must be unique across the platform.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  B2B Password {view === 'edit' && <span className="text-xs font-normal text-slate-400">(Leave blank to keep current)</span>}
                </label>
                <input
                  type="text"
                  name="b2bPassword"
                  value={formData.b2bPassword}
                  onChange={handleChange}
                  required={view === 'create'}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-mono"
                  placeholder={view === 'edit' ? "Enter new password" : "Enter a secure password"}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700">
            <button
              type="button"
              onClick={() => setView('list')}
              className="px-6 py-2.5 rounded-xl font-medium text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/30"
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
