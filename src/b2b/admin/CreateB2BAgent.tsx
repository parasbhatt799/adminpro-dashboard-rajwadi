import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { UserPlus, ArrowLeft, ShieldCheck, Edit, Trash2, Settings, KeyRound, Copy, RefreshCw, Edit3, Globe, Building2, CheckCircle2, X, Search, Camera, User, Zap, Layers, Plus } from 'lucide-react';
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
  payout_wallet_balance?: number;
  is_bbps_enabled?: boolean;
  is_payout_enabled?: boolean;
  payout_slabs?: any[];
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

  // Custom Payout Slabs Modal State
  const [showSlabsModal, setShowSlabsModal] = useState(false);
  const [customSlabs, setCustomSlabs] = useState<any[]>([]);
  const [selectedAgentForSlabs, setSelectedAgentForSlabs] = useState<Agent | null>(null);

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
    agentTag: '',
    isBbpsEnabled: true,
    isPayoutEnabled: false
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
      agentTag: agent.agent_tag || '',
      isBbpsEnabled: agent.is_bbps_enabled !== false,
      isPayoutEnabled: !!agent.is_payout_enabled
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

  const toggleBbps = async (agent: Agent) => {
    const newStatus = !(agent.is_bbps_enabled !== false);
    const { error } = await supabase
      .from('b2b_api_credentials')
      .update({ is_bbps_enabled: newStatus })
      .eq('id', agent.id);

    if (!error) {
      toast.success(`BBPS Service ${newStatus ? 'enabled' : 'disabled'}`);
      setAgents(agents.map(a => a.id === agent.id ? { ...a, is_bbps_enabled: newStatus } : a));
      if (selectedAgentForApi?.id === agent.id) {
        setSelectedAgentForApi({ ...selectedAgentForApi, is_bbps_enabled: newStatus });
      }
    } else {
      toast.error('Failed to change BBPS status');
    }
  };

  const togglePayout = async (agent: Agent) => {
    const newStatus = !agent.is_payout_enabled;
    const { error } = await supabase
      .from('b2b_api_credentials')
      .update({ is_payout_enabled: newStatus })
      .eq('id', agent.id);

    if (!error) {
      toast.success(`Payout Service ${newStatus ? 'enabled' : 'disabled'}`);
      setAgents(agents.map(a => a.id === agent.id ? { ...a, is_payout_enabled: newStatus } : a));
      if (selectedAgentForApi?.id === agent.id) {
        setSelectedAgentForApi({ ...selectedAgentForApi, is_payout_enabled: newStatus });
      }
    } else {
      toast.error('Failed to change Payout status');
    }
  };

  const openSlabsModal = (agent: Agent) => {
    setSelectedAgentForSlabs(agent);
    const defaultSlabs = [
      { id: 'slab-1', min_amount: 100, max_amount: 50000, charge_type: 'flat', charge_value: 25, is_active: true },
      { id: 'slab-2', min_amount: 50001, max_amount: 100000, charge_type: 'flat', charge_value: 50, is_active: true },
      { id: 'slab-3', min_amount: 100001, max_amount: 200000, charge_type: 'flat', charge_value: 75, is_active: true }
    ];
    setCustomSlabs(agent.payout_slabs && Array.isArray(agent.payout_slabs) && agent.payout_slabs.length > 0 
      ? JSON.parse(JSON.stringify(agent.payout_slabs)) 
      : defaultSlabs);
    setShowSlabsModal(true);
  };

  const handleAddSlab = () => {
    const newId = `slab-${Date.now()}`;
    setCustomSlabs([...customSlabs, {
      id: newId,
      min_amount: 1,
      max_amount: 10000,
      charge_type: 'flat',
      charge_value: 10,
      is_active: true
    }]);
  };

  const handleRemoveSlab = (id: string) => {
    setCustomSlabs(customSlabs.filter(s => s.id !== id));
  };

  const handleSlabChange = (index: number, field: string, val: any) => {
    const updated = [...customSlabs];
    updated[index] = { ...updated[index], [field]: val };
    setCustomSlabs(updated);
  };

  const saveCustomSlabs = async () => {
    if (!selectedAgentForSlabs) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('b2b_api_credentials')
        .update({ payout_slabs: customSlabs })
        .eq('id', selectedAgentForSlabs.id);

      if (error) throw error;
      toast.success('Custom Payout Slabs saved successfully!');
      setAgents(agents.map(a => a.id === selectedAgentForSlabs.id ? { ...a, payout_slabs: customSlabs } : a));
      if (selectedAgentForApi?.id === selectedAgentForSlabs.id) {
        setSelectedAgentForApi({ ...selectedAgentForApi, payout_slabs: customSlabs });
      }
      setShowSlabsModal(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to save payout slabs');
    } finally {
      setIsSaving(false);
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
            is_active: true,
            is_bbps_enabled: formData.isBbpsEnabled,
            is_payout_enabled: formData.isPayoutEnabled,
            payout_wallet_balance: 0
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
          profile_photo_url: uploadedPhotoUrl || null,
          is_bbps_enabled: formData.isBbpsEnabled,
          is_payout_enabled: formData.isPayoutEnabled
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
        firstName: '', lastName: '', mobile: '', address: '', b2bLoginId: '', b2bPassword: '', chargePerBill: '', developerCharge: '0', ownerCharge: '0', fixedDepositAmount: '0', agentTag: '', isBbpsEnabled: true, isPayoutEnabled: false
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
    <div className="w-full space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">B2B Agents</h2>
          <p className="text-slate-400 mt-1">Manage your onboarded B2B agents and their balances & charges.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-80">
            <input
              type="text"
              placeholder="Search agent, login ID, charge..."
              value={agentSearchTerm}
              onChange={(e) => setAgentSearchTerm(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2.5 pl-9 pr-8 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
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
              setFormData({ firstName: '', lastName: '', mobile: '', address: '', b2bLoginId: '', b2bPassword: '', chargePerBill: '', developerCharge: '0', ownerCharge: '0', fixedDepositAmount: '0', agentTag: '', isBbpsEnabled: true, isPayoutEnabled: false });
              setView('create');
            }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-sm whitespace-nowrap cursor-pointer active:scale-95"
          >
            <UserPlus size={18} />
            Create Agent
          </button>
        </div>
      </div>

      <div className="bg-slate-800 rounded-2xl shadow-xl border border-slate-700 overflow-hidden w-full">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/60 border-b border-slate-700 text-xs uppercase tracking-wider font-bold">
                <th className="py-4 px-5 text-left text-slate-200">Agent Name</th>
                <th className="py-4 px-5 text-center whitespace-nowrap text-sky-400">Login ID & Mobile</th>
                <th className="py-4 px-4 text-center whitespace-nowrap text-fuchsia-400">Tag / Portal</th>
                <th className="py-4 px-5 text-center whitespace-nowrap text-amber-400">Charge (₹)</th>
                <th className="py-4 px-5 text-center whitespace-nowrap text-emerald-400">
                  <span className="inline-flex items-center gap-1 font-bold">
                    <Zap size={13} /> BBPS Wallet
                  </span>
                </th>
                <th className="py-4 px-5 text-center whitespace-nowrap text-purple-400">
                  <span className="inline-flex items-center gap-1 font-bold">
                    <Layers size={13} /> Payout Wallet
                  </span>
                </th>
                <th className="py-4 px-5 text-center whitespace-nowrap text-amber-400">
                  <span className="inline-flex items-center gap-1 font-bold">
                    Fixed Deposit
                  </span>
                </th>
                <th className="py-4 px-5 text-center text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    Loading agents...
                  </td>
                </tr>
              ) : filteredAgents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    {agentSearchTerm ? 'No agents match your search criteria.' : 'No agents found. Click "Create Agent" to onboard one.'}
                  </td>
                </tr>
              ) : (
                filteredAgents.map((agent) => (
                  <tr key={agent.id} className="hover:bg-slate-700/20 transition-colors">
                    <td className="py-4 px-5 font-bold text-white text-left">
                      <div className="flex items-center gap-3">
                        {agent.profile_photo_url ? (
                          <img
                            src={agent.profile_photo_url}
                            alt={`${agent.first_name} ${agent.last_name}`}
                            className="w-10 h-10 rounded-full object-cover border border-slate-700 shadow-sm shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center text-xs font-bold shrink-0">
                            {agent.first_name?.[0]?.toUpperCase() || ''}{agent.last_name?.[0]?.toUpperCase() || <User size={16} />}
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-white text-sm">{agent.first_name} {agent.last_name}</div>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {agent.billavenue_agent_id ? (
                              <span className="text-[10px] text-emerald-400 font-mono font-semibold bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded" title="BillAvenue Mapping Agent ID">
                                {agent.billavenue_agent_id}
                              </span>
                            ) : null}
                            {agent.is_bbps_enabled !== false ? (
                              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded flex items-center gap-0.5" title="BBPS Bill Payment Active">
                                <Zap size={9} /> BBPS
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500 bg-slate-900 border border-slate-700 px-1.5 py-0.5 rounded">
                                No BBPS
                              </span>
                            )}
                            {agent.is_payout_enabled ? (
                              <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded flex items-center gap-0.5" title="Instant Payout API Active">
                                <Layers size={9} /> Payout
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </td>
                    {/* Combined: Login ID (Top) & Mobile Number (Bottom) - Sky Blue */}
                    <td className="py-4 px-5 text-center">
                      <div className="flex flex-col items-center justify-center gap-0.5">
                        <span className="text-sky-400 font-mono text-xs font-semibold">{agent.b2b_login_id}</span>
                        <span className="text-slate-400 font-mono text-[11px]">{agent.mobile}</span>
                      </div>
                    </td>
                    {/* Tag / Portal - Fuchsia / Purple */}
                    <td className="py-4 px-4 text-center">
                      {agent.agent_tag ? (
                        <span className="bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20 px-2.5 py-1 rounded-lg text-xs font-bold font-mono">
                          {agent.agent_tag}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-xs">-</span>
                      )}
                    </td>
                    {/* Charge */}
                    <td className="py-4 px-5 text-center">
                      {agent.charge_per_bill !== null && agent.charge_per_bill !== undefined ? (
                        <div className="flex flex-col items-center justify-center gap-1">
                          <span className="font-bold text-amber-400 text-sm">₹{parseFloat(agent.charge_per_bill.toString()).toFixed(2)}</span>
                          <div className="flex items-center justify-center gap-1 text-[10px] font-mono">
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
                    {/* BBPS Wallet */}
                    <td className="py-4 px-5 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-emerald-400 font-bold font-mono text-sm">
                          ₹{parseFloat(agent.wallet_balance?.toString() || '0').toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        {agent.is_bbps_enabled === false && (
                          <span className="text-[10px] text-slate-500 font-medium">Inactive</span>
                        )}
                      </div>
                    </td>
                    {/* Payout Wallet */}
                    <td className="py-4 px-5 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-purple-400 font-bold font-mono text-sm">
                          ₹{parseFloat(agent.payout_wallet_balance?.toString() || '0').toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        {!agent.is_payout_enabled && (
                          <span className="text-[10px] text-slate-500 font-medium">Inactive</span>
                        )}
                      </div>
                    </td>
                    {/* Fixed Deposit */}
                    <td className="py-4 px-5 text-center">
                      <div className="flex flex-col items-center justify-center">
                        {agent.fixed_deposit_amount && parseFloat(agent.fixed_deposit_amount.toString()) > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-md" title="Frozen Security Deposit Balance">
                            🔒 ₹{parseFloat(agent.fixed_deposit_amount.toString()).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-slate-500 font-mono text-xs">₹0.00</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {agent.is_payout_enabled && (
                          <button
                            onClick={() => openSlabsModal(agent)}
                            className="p-2 text-purple-400 hover:bg-purple-500/10 rounded-lg transition-colors"
                            title="Configure Custom Payout Slabs"
                          >
                            <Layers size={18} />
                          </button>
                        )}
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
            className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] overflow-y-auto text-slate-200"
          >
            {/* Modal Header */}
            <div className="py-4 px-6 border-b border-slate-700 bg-slate-900/90 flex justify-between items-center sticky top-0 z-10">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Settings className="h-5 w-5 text-indigo-400" /> API Settings
                </h3>
                <p className="text-sm text-slate-400 mt-0.5">
                  Manage API configuration for <span className="font-semibold text-white">{selectedAgentForApi.first_name} {selectedAgentForApi.last_name}</span> (Login ID: <span className="font-mono text-indigo-300">{selectedAgentForApi.b2b_login_id}</span>)
                </p>
              </div>
              <div className="flex items-center gap-4">
                {/* Toggle switch for enable/disable */}
                <div className="flex items-center gap-2.5 border-r border-slate-700 pr-4">
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
            
            <div className="p-5 sm:p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
                
                {/* LEFT COLUMN: Credentials & Whitelist */}
                <div className="space-y-4">
                  {/* Credentials Section */}
                  <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-700 shadow-sm">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
                        <KeyRound className="h-4 w-4 text-indigo-400" /> API Credentials
                      </h4>
                      {selectedAgentForApi.api_key && selectedAgentForApi.secret_key && (
                        <button 
                          onClick={() => handleGenerateKeys(selectedAgentForApi)}
                          className="text-xs font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1.5 bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20 transition-colors"
                        >
                          <RefreshCw className="h-3.5 w-3.5" /> Regenerate Keys
                        </button>
                      )}
                    </div>
                    {selectedAgentForApi.api_key && selectedAgentForApi.secret_key ? (
                      <div className="space-y-3">
                        <div>
                          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">API Key</span>
                          <div className="flex items-center gap-2">
                            <code className="text-sm text-indigo-300 font-mono truncate block flex-1 bg-slate-900 px-3 py-2 rounded-lg border border-slate-700">
                              {selectedAgentForApi.api_key}
                            </code>
                            <button onClick={() => handleCopy(selectedAgentForApi.api_key!)} title="Copy API Key" className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors bg-slate-900 border border-slate-700 shrink-0">
                              <Copy className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Secret Key</span>
                          <div className="flex items-center gap-2">
                            <code className="text-sm text-indigo-300 font-mono truncate block flex-1 bg-slate-900 px-3 py-2 rounded-lg border border-slate-700">
                              ••••••••••••••••••••••••••••
                            </code>
                            <button onClick={() => handleCopy(selectedAgentForApi.secret_key!)} title="Copy Secret Key" className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors bg-slate-900 border border-slate-700 shrink-0">
                              <Copy className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-amber-950/30 border border-amber-500/20 rounded-xl p-4 flex flex-col items-center justify-center gap-2.5">
                        <p className="text-xs text-amber-300 font-medium text-center">API Keys have not been generated for this agent yet.</p>
                        <button
                          onClick={() => handleGenerateKeys(selectedAgentForApi)}
                          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs shadow-sm transition-colors"
                        >
                          Generate API Keys Now
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Whitelisting: IPs and Domains */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* IP Whitelist */}
                    <div className="border border-slate-700 rounded-xl p-4 bg-slate-900/40 shadow-sm flex flex-col justify-between">
                      <div className="flex justify-between items-center mb-2.5">
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
                          <ShieldCheck className="h-4 w-4 text-indigo-400" /> Whitelisted IPs
                        </h4>
                        <button onClick={() => openIpModal(selectedAgentForApi)} className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 bg-indigo-500/10 px-2.5 py-1 rounded-md border border-indigo-500/20">
                          <Edit3 className="h-3 w-3" /> Manage
                        </button>
                      </div>
                      <div className="min-h-[34px] flex items-center">
                        {selectedAgentForApi.ip_whitelist && selectedAgentForApi.ip_whitelist.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto pr-1">
                            {selectedAgentForApi.ip_whitelist.map((ip: string) => (
                              <span key={ip} className="px-2.5 py-1 bg-slate-900 text-slate-300 rounded-md text-xs font-mono border border-slate-700">
                                {ip}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-rose-400 font-medium">No IPs Whitelisted</span>
                        )}
                      </div>
                    </div>

                    {/* Domain Whitelist */}
                    <div className="border border-slate-700 rounded-xl p-4 bg-slate-900/40 shadow-sm flex flex-col justify-between">
                      <div className="flex justify-between items-center mb-2.5">
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
                          <Globe className="h-4 w-4 text-indigo-400" /> Domains
                        </h4>
                        <button onClick={() => openDomainModal(selectedAgentForApi)} className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 bg-indigo-500/10 px-2.5 py-1 rounded-md border border-indigo-500/20">
                          <Edit3 className="h-3 w-3" /> Manage
                        </button>
                      </div>
                      <div className="min-h-[34px] flex items-center">
                        {selectedAgentForApi.domain_whitelist && selectedAgentForApi.domain_whitelist.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto pr-1">
                            {selectedAgentForApi.domain_whitelist.map((domain: string) => (
                              <span key={domain} className="px-2.5 py-1 bg-slate-900 text-slate-300 rounded-md text-xs font-mono border border-slate-700">
                                {domain}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-rose-400 font-medium">No Domains Whitelisted</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN: Services & Slabs & BillAvenue */}
                <div className="space-y-4">
                  {/* Services Access Toggles */}
                  <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4 sm:p-5 shadow-sm space-y-3">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
                      <Zap className="h-4 w-4 text-indigo-400" /> Services Access Control
                    </h4>
                    
                    <div className="space-y-2.5">
                      {/* BBPS Toggle */}
                      <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-700/80 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-bold text-white flex items-center gap-1.5">
                            <Zap size={16} className="text-emerald-400" /> Bill Payment (BBPS)
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">Allow agent to fetch & pay bills</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={selectedAgentForApi.is_bbps_enabled !== false}
                            onChange={() => toggleBbps(selectedAgentForApi)}
                          />
                          <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>

                      {/* Payout Toggle */}
                      <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-700/80 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-bold text-white flex items-center gap-1.5">
                            <Layers size={16} className="text-purple-400" /> Instant Payout API
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">Allow 24x7 IMPS/NEFT bank transfers</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={!!selectedAgentForApi.is_payout_enabled}
                            onChange={() => togglePayout(selectedAgentForApi)}
                          />
                          <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Custom Payout Slabs Config */}
                  <div className="bg-purple-950/20 border border-purple-500/20 rounded-xl p-4 flex items-center justify-between gap-3 shadow-sm">
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold text-purple-300 uppercase tracking-widest block mb-0.5">
                        Partner Custom Payout Slabs
                      </span>
                      <p className="text-xs text-slate-300">
                        {selectedAgentForApi.payout_slabs && Array.isArray(selectedAgentForApi.payout_slabs) && selectedAgentForApi.payout_slabs.length > 0
                          ? `${selectedAgentForApi.payout_slabs.length} custom slab(s) configured for this agent`
                          : 'Using Default Global Payout Slabs (No custom override)'}
                      </p>
                    </div>
                    <button
                      onClick={() => openSlabsModal(selectedAgentForApi)}
                      className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0 shadow-sm"
                    >
                      <Layers size={14} /> Configure Slabs
                    </button>
                  </div>

                  {/* BillAvenue Mapping */}
                  <div className="bg-sky-950/20 border border-sky-500/20 rounded-xl p-4 flex items-center justify-between gap-3 shadow-sm">
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold text-sky-400 uppercase tracking-widest block mb-2">
                        BillAvenue Agent ID Mapping
                      </span>
                      <div className="text-xs text-slate-300 font-mono">
                        {selectedAgentForApi.billavenue_agent_id ? (
                          <span className="inline-block text-sky-300 font-bold bg-slate-900 px-3 py-1 rounded-md border border-sky-500/30">
                            {selectedAgentForApi.billavenue_agent_id}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Not mapped yet (Needed for BBPS)</span>
                        )}
                      </div>
                    </div>
                    <button 
                      onClick={() => openAgentIdModal(selectedAgentForApi)} 
                      className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0 shadow-sm"
                    >
                      <Edit3 size={14} /> Edit Mapping
                    </button>
                  </div>
                </div>

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

      {/* Custom Payout Slabs Modal */}
      {showSlabsModal && selectedAgentForSlabs && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden text-slate-200"
          >
            <div className="p-6 border-b border-slate-700 bg-purple-950/40 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Layers className="text-purple-400 h-5 w-5" /> Custom Payout Slabs
                </h3>
                <p className="text-xs text-purple-300 mt-1">
                  Configure custom partner fee slabs for <span className="font-bold text-white">{selectedAgentForSlabs.first_name} {selectedAgentForSlabs.last_name}</span> ({selectedAgentForSlabs.b2b_login_id})
                </p>
              </div>
              <button 
                onClick={() => setShowSlabsModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-900 border border-slate-700"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Configured Slabs</span>
                <button
                  type="button"
                  onClick={handleAddSlab}
                  className="px-3 py-1.5 bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 border border-purple-500/40 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                >
                  <Plus size={14} /> Add Slab
                </button>
              </div>

              {customSlabs.length === 0 ? (
                <div className="p-6 text-center text-slate-400 bg-slate-900/50 rounded-xl border border-slate-700/60">
                  No custom slabs set. Agent will use system default slabs. Click "+ Add Slab" to create custom pricing.
                </div>
              ) : (
                <div className="space-y-3">
                  {customSlabs.map((slab, index) => (
                    <div key={slab.id || index} className="p-3 bg-slate-900/80 border border-slate-700 rounded-xl grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-3">
                        <label className="text-[10px] text-slate-400 block mb-0.5">Min Amount (₹)</label>
                        <input
                          type="number"
                          value={slab.min_amount}
                          onChange={(e) => handleSlabChange(index, 'min_amount', parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                        />
                      </div>
                      <div className="col-span-3">
                        <label className="text-[10px] text-slate-400 block mb-0.5">Max Amount (₹)</label>
                        <input
                          type="number"
                          value={slab.max_amount}
                          onChange={(e) => handleSlabChange(index, 'max_amount', parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] text-slate-400 block mb-0.5">Type</label>
                        <select
                          value={slab.charge_type || 'flat'}
                          onChange={(e) => handleSlabChange(index, 'charge_type', e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
                        >
                          <option value="flat">Flat (₹)</option>
                          <option value="percentage">Percent (%)</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] text-slate-400 block mb-0.5">Charge</label>
                        <input
                          type="number"
                          step="0.01"
                          value={slab.charge_value}
                          onChange={(e) => handleSlabChange(index, 'charge_value', parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-amber-400 font-bold font-mono"
                        />
                      </div>
                      <div className="col-span-2 flex items-center justify-end gap-1 pt-3">
                        <label className="relative inline-flex items-center cursor-pointer mr-1" title={slab.is_active ? 'Active' : 'Disabled'}>
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={slab.is_active !== false}
                            onChange={(e) => handleSlabChange(index, 'is_active', e.target.checked)}
                          />
                          <div className="w-8 h-4 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-600 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                        <button
                          type="button"
                          onClick={() => handleRemoveSlab(slab.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                          title="Remove Slab"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-700 bg-slate-900/60 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowSlabsModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-300 bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveCustomSlabs}
                disabled={isSaving}
                className="px-5 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Save Custom Slabs'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );

  const renderForm = () => (
    <div className="w-full space-y-6">
      {/* Top Header Bar */}
      <div className="bg-slate-800/80 backdrop-blur-md rounded-2xl border border-slate-700 p-5 shadow-lg flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setView('list')}
            className="p-2.5 bg-slate-900 hover:bg-slate-700 rounded-xl border border-slate-700 text-slate-300 hover:text-white transition-all shadow-sm"
            title="Back to Agent List"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {view === 'create' ? 'Onboard New B2B Agent' : 'Edit B2B Agent'}
              </h2>
              {view === 'create' ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  New Partner
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  ID: {formData.b2bLoginId || 'Agent'}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400 mt-1">
              {view === 'create'
                ? 'Register basic details, wallet rates, portal branding, and API permissions.'
                : 'Update agent profile, commercial rates, portal tag, and credentials.'}
            </p>
          </div>
        </div>

        {/* Top Quick Actions */}
        <div className="flex items-center gap-3 self-end md:self-auto">
          <button
            type="button"
            onClick={() => setView('list')}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-700 border border-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            form="b2b-agent-form"
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            {view === 'create' ? 'Complete Registration' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Main Form Area */}
      <form id="b2b-agent-form" onSubmit={handleSubmit} className="w-full">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          
          {/* LEFT COLUMN: Profile Avatar Preview & API Services (xl:col-span-4) */}
          <div className="xl:col-span-4 space-y-6">
            
            {/* Identity & Photo Card */}
            <div className="bg-slate-800 rounded-2xl shadow-xl border border-slate-700 overflow-hidden">
              <div className="p-4 border-b border-slate-700 bg-slate-900/60 flex items-center gap-2.5">
                <div className="bg-indigo-500/10 p-1.5 rounded-lg text-indigo-400 border border-indigo-500/20">
                  <User className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-white text-sm">Agent Identity & Avatar</h3>
              </div>

              <div className="p-6 flex flex-col items-center text-center">
                {/* Profile Photo Uploader */}
                <div className="relative group mb-4">
                  <label className="w-28 h-28 bg-slate-900 rounded-full border-2 border-dashed border-indigo-500/40 hover:border-indigo-400 flex flex-col items-center justify-center text-slate-400 overflow-hidden cursor-pointer transition-all shadow-inner group-hover:scale-105">
                    {photoPreview ? (
                      <img src={photoPreview} alt="Agent Preview" className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <Camera size={26} className="text-indigo-400 group-hover:text-indigo-300" />
                        <span className="text-[10px] font-bold uppercase mt-1 text-slate-400 group-hover:text-slate-200">Upload Photo</span>
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
                      className="absolute top-0 right-0 bg-rose-500 hover:bg-rose-600 text-white p-1.5 rounded-full shadow-lg transition-transform hover:scale-110"
                      title="Remove Photo"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <h4 className="text-base font-bold text-white">
                  {formData.firstName || formData.lastName ? `${formData.firstName} ${formData.lastName}`.trim() : 'Agent Name'}
                </h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md">
                    @{formData.b2bLoginId || 'login_id'}
                  </span>
                  {formData.agentTag && (
                    <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                      {formData.agentTag}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-2 font-mono">
                  {formData.mobile ? `+91 ${formData.mobile}` : 'Mobile not specified'}
                </p>

                <div className="w-full border-t border-slate-700/60 mt-4 pt-4 flex items-center justify-between text-xs text-slate-400">
                  <span>Partner Status</span>
                  <span className="inline-flex items-center gap-1.5 font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Active
                  </span>
                </div>
              </div>
            </div>

            {/* Services & Modules Permissions */}
            <div className="bg-slate-800 rounded-2xl shadow-xl border border-slate-700 overflow-hidden">
              <div className="p-4 border-b border-slate-700 bg-slate-900/60 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="bg-emerald-500/10 p-1.5 rounded-lg text-emerald-400 border border-emerald-500/20">
                    <Zap className="h-4 w-4" />
                  </div>
                  <h3 className="font-bold text-white text-sm">Services & Permissions</h3>
                </div>
                <span className="text-[11px] text-slate-400">Live Access</span>
              </div>

              <div className="p-4 space-y-3">
                {/* BBPS Toggle */}
                <div 
                  onClick={() => setFormData(prev => ({ ...prev, isBbpsEnabled: !prev.isBbpsEnabled }))}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                    formData.isBbpsEnabled 
                      ? 'bg-emerald-500/10 border-emerald-500/40 shadow-sm shadow-emerald-500/10' 
                      : 'bg-slate-900/70 border-slate-700 opacity-70 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${formData.isBbpsEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                      <Zap size={18} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">Bill Payment (BBPS)</div>
                      <p className="text-[11px] text-slate-400 mt-0.5">BBPS fetch & pay endpoints & wallet</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.isBbpsEnabled}
                    onChange={(e) => setFormData(prev => ({ ...prev, isBbpsEnabled: e.target.checked }))}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-5 h-5 bg-slate-800 border-slate-700 cursor-pointer"
                  />
                </div>

                {/* Instant Payout Toggle */}
                <div 
                  onClick={() => setFormData(prev => ({ ...prev, isPayoutEnabled: !prev.isPayoutEnabled }))}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                    formData.isPayoutEnabled 
                      ? 'bg-purple-500/10 border-purple-500/40 shadow-sm shadow-purple-500/10' 
                      : 'bg-slate-900/70 border-slate-700 opacity-70 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${formData.isPayoutEnabled ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-800 text-slate-500'}`}>
                      <Layers size={18} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">Instant Payout API</div>
                      <p className="text-[11px] text-slate-400 mt-0.5">24x7 IMPS/NEFT bank payout API & wallet</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.isPayoutEnabled}
                    onChange={(e) => setFormData(prev => ({ ...prev, isPayoutEnabled: e.target.checked }))}
                    className="rounded text-purple-600 focus:ring-purple-500 w-5 h-5 bg-slate-800 border-slate-700 cursor-pointer"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Form Inputs in Structured Cards (xl:col-span-8) */}
          <div className="xl:col-span-8 space-y-6">
            
            {/* Card 1: Basic Profile Details */}
            <div className="bg-slate-800 rounded-2xl shadow-xl border border-slate-700 overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-700 bg-slate-900/60 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="bg-indigo-500/10 p-2 rounded-lg text-indigo-400 border border-indigo-500/20">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">1. Basic Profile & Portal Details</h3>
                    <p className="text-xs text-slate-400">Personal information and branding tag</p>
                  </div>
                </div>
              </div>

              <div className="p-5 sm:p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">First Name *</label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-sm"
                      placeholder="e.g. Riyaz"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Last Name *</label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-sm"
                      placeholder="e.g. Mahida"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Mobile Number *</label>
                    <input
                      type="tel"
                      name="mobile"
                      value={formData.mobile}
                      onChange={handleChange}
                      required
                      pattern="[0-9]{10}"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-mono text-sm"
                      placeholder="10-digit number"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span>Portal Tag</span>
                      <span className="text-[10px] text-slate-400 font-normal">e.g. Rajwadi</span>
                    </label>
                    <input
                      type="text"
                      name="agentTag"
                      value={formData.agentTag}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-indigo-300 font-bold placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-mono text-sm"
                      placeholder="Portal Name / Tag"
                    />
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="text-[10px] text-slate-500">Quick set:</span>
                      {['Rajwadi', 'Zentopay', 'UsePay'].map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, agentTag: tag }))}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-700 text-slate-400 hover:text-indigo-300 border border-slate-700 transition-colors"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Full Address</label>
                    <textarea
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      rows={2}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all resize-none text-sm"
                      placeholder="Enter complete office/residence address"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Commercial Rates & Balance Rules */}
            <div className="bg-slate-800 rounded-2xl shadow-xl border border-slate-700 overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-700 bg-slate-900/60 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="bg-amber-500/10 p-2 rounded-lg text-amber-400 border border-amber-500/20">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">2. Commercial Rates & Security Rules</h3>
                    <p className="text-xs text-slate-400">Per-bill fee deduction and security deposit setup</p>
                  </div>
                </div>
              </div>

              <div className="p-5 sm:p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                    <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span>Total Charge per Bill (₹)</span>
                      <span className="text-[10px] text-amber-400/80 font-normal">Deducted from Agent</span>
                    </label>
                    <input
                      type="number"
                      name="chargePerBill"
                      value={formData.chargePerBill}
                      onChange={handleTotalChargeChange}
                      min="0"
                      step="0.01"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-amber-500/40 text-amber-400 font-bold placeholder-slate-500 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all font-mono text-lg"
                      placeholder="0.00"
                    />
                    <p className="text-[11px] text-slate-400 mt-1.5">Total fee deducted from agent wallet per transaction.</p>
                  </div>

                  <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                    <label className="block text-xs font-bold text-amber-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span>Fix Security Deposit (₹)</span>
                      <span className="text-[10px] text-amber-400/80 font-normal">Frozen Balance</span>
                    </label>
                    <input
                      type="number"
                      name="fixedDepositAmount"
                      value={formData.fixedDepositAmount}
                      onChange={handleChange}
                      min="0"
                      step="100"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-amber-500/40 text-amber-300 font-bold placeholder-slate-500 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all font-mono text-lg"
                      placeholder="0"
                    />
                    <p className="text-[11px] text-slate-400 mt-1.5">Frozen from wallet. Usable balance = Wallet - Deposit.</p>
                  </div>
                </div>

                {/* Developer & Owner Charge Split */}
                <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-700/80 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-slate-800">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Internal Revenue Split (Developer + Owner = Total)
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      Split Total: ₹{formData.chargePerBill || '0'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-blue-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>Developer Charge (₹)</span>
                        <span className="text-[10px] text-slate-500">Internal Portion</span>
                      </label>
                      <input
                        type="number"
                        name="developerCharge"
                        value={formData.developerCharge}
                        onChange={handleDeveloperChargeChange}
                        min="0"
                        step="0.01"
                        className="w-full px-3.5 py-2 rounded-lg bg-slate-900 border border-blue-500/40 text-blue-300 font-bold placeholder-slate-500 focus:border-blue-400 outline-none transition-all font-mono text-sm"
                        placeholder="0.00"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">Developer revenue portion per bill.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-purple-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>Owner Charge (₹)</span>
                        <span className="text-[10px] text-slate-500">Internal Portion</span>
                      </label>
                      <input
                        type="number"
                        name="ownerCharge"
                        value={formData.ownerCharge}
                        onChange={handleOwnerChargeChange}
                        min="0"
                        step="0.01"
                        className="w-full px-3.5 py-2 rounded-lg bg-slate-900 border border-purple-500/40 text-purple-300 font-bold placeholder-slate-500 focus:border-purple-400 outline-none transition-all font-mono text-sm"
                        placeholder="0.00"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">Owner revenue portion per bill.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3: B2B Login Credentials */}
            <div className="bg-slate-800 rounded-2xl shadow-xl border border-slate-700 overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-700 bg-slate-900/60 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="bg-emerald-500/10 p-2 rounded-lg text-emerald-400 border border-emerald-500/20">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">3. B2B Login Credentials</h3>
                    <p className="text-xs text-slate-400">Agent portal access and authentication</p>
                  </div>
                </div>
              </div>

              <div className="p-5 sm:p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      B2B Login ID *
                    </label>
                    <input
                      type="text"
                      name="b2bLoginId"
                      value={formData.b2bLoginId}
                      onChange={handleChange}
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-mono text-sm"
                      placeholder="e.g. agent_riyaz"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">Must be unique across the platform.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      B2B Password {view === 'edit' && <span className="text-[10px] lowercase font-normal text-slate-400">(leave blank to keep current)</span>} *
                    </label>
                    <input
                      type="text"
                      name="b2bPassword"
                      value={formData.b2bPassword}
                      onChange={handleChange}
                      required={view === 'create'}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-mono text-sm"
                      placeholder={view === 'edit' ? "Enter new password if changing" : "Enter a secure password"}
                    />
                    <p className="text-[11px] text-slate-400 mt-1">Used by the agent to log into their dashboard.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="bg-slate-800 rounded-2xl shadow-xl border border-slate-700 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-400 text-center sm:text-left">
                Ensure all details and financial charge splits are accurate before saving.
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setView('list')}
                  className="px-5 py-2.5 rounded-xl font-semibold text-sm text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-700 border border-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {loading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  {view === 'create' ? 'Complete Registration' : 'Update Agent Details'}
                </button>
              </div>
            </div>

          </div>

        </div>
      </form>
    </div>
  );

  return view === 'list' ? renderList() : renderForm();
}
