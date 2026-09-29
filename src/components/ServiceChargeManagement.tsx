import { LogoLoader } from './shared/LoadingSpinner';
import { 
  Receipt, 
  Plus, 
  Trash2, 
  Edit3, 
  Edit2,
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  X,
  IndianRupee,
  Percent,
  ArrowRight,
  Layers,
  RefreshCw,
  SlidersVertical,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useSearchParams } from 'react-router-dom';

interface Slab {
  id: string;
  min_amount: number;
  max_amount: number;
  charge_amount: number;
  is_percentage: boolean;
  is_active: boolean;
  created_at: string;
}

export interface PayoutSlab {
  id: string;
  min_amount: number;
  max_amount: number;
  charge_type: 'flat' | 'percentage';
  charge_value: number;
  is_active: boolean;
}

interface ServiceChargeManagementProps {
  adminRole?: string;
}

export default function ServiceChargeManagement({ adminRole }: ServiceChargeManagementProps) {
  const isFullAdmin = adminRole === 'full';
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'payout' ? 'payout' : 'service';
  const [activeTab, setActiveTab] = useState<'service' | 'payout'>(initialTab);

  // Sync tab from URL searchParams
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'payout' || tab === 'service') {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // General Service Charge Slabs State
  const [slabs, setSlabs] = useState<Slab[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingSlab, setEditingSlab] = useState<Slab | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Dynamic Payout Slabs State
  const [payoutSlabs, setPayoutSlabs] = useState<PayoutSlab[]>([]);
  const [loadingPayoutSlabs, setLoadingPayoutSlabs] = useState(false);
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [editingPayoutSlab, setEditingPayoutSlab] = useState<PayoutSlab | null>(null);
  const [payoutSlabForm, setPayoutSlabForm] = useState({
    min_amount: '',
    max_amount: '',
    charge_type: 'flat' as 'flat' | 'percentage',
    charge_value: '',
    is_active: true
  });
  const [savingPayoutSlab, setSavingPayoutSlab] = useState(false);
  const [payoutDeleteConfirm, setPayoutDeleteConfirm] = useState<string | null>(null);
  const [isDeletingPayoutSlab, setIsDeletingPayoutSlab] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [payoutSuccess, setPayoutSuccess] = useState<string | null>(null);

  // Bank Verification State
  const [verificationCharge, setVerificationCharge] = useState<number>(3);
  const [isVerificationEnabled, setIsVerificationEnabled] = useState<boolean>(true);
  const [savingVerificationSettings, setSavingVerificationSettings] = useState<boolean>(false);
  const [verificationStats, setVerificationStats] = useState<{ totalCount: number; totalFees: number }>({ totalCount: 0, totalFees: 0 });

  const [qrMinLimit, setQrMinLimit] = useState<number>(100);
  const [qrMaxLimit, setQrMaxLimit] = useState<number>(100000);
  const [bbpsMaxLimit, setBbpsMaxLimit] = useState<number>(50000);
  const [billavenueMaxLimit, setBillavenueMaxLimit] = useState<number>(49999);
  const [csplMaxLimit, setCsplMaxLimit] = useState<number>(49999);
  const [dailyLiveBbpsLimit, setDailyLiveBbpsLimit] = useState<number>(500000);
  const [dailyNormalBillLimit, setDailyNormalBillLimit] = useState<number>(500000);
  const [tPlusOneLimit, setTPlusOneLimit] = useState<number>(0);
  const [dsMinFundTransferLimit, setDsMinFundTransferLimit] = useState<number>(0);
  const [mdMinFundTransferLimit, setMdMinFundTransferLimit] = useState<number>(0);
  const [limitsSaving, setLimitsSaving] = useState(false);
  const [limitsSuccess, setLimitsSuccess] = useState<string | null>(null);
  const [limitsError, setLimitsError] = useState<string | null>(null);

  const [isFundTransferEnabled, setIsFundTransferEnabled] = useState<boolean>(true);
  const [togglingFundTransfer, setTogglingFundTransfer] = useState(false);
  const [isDmtEnabled, setIsDmtEnabled] = useState<boolean>(true);
  const [togglingDmt, setTogglingDmt] = useState(false);

  const [formData, setFormData] = useState({
    min_amount: '',
    max_amount: '',
    charge_amount: '',
    is_percentage: false,
  });

  const fetchSlabs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('service_charge_slabs')
        .select('*')
        .order('min_amount', { ascending: true });

      if (error) throw error;
      setSlabs(data || []);
    } catch (err) {
      console.error('Error fetching slabs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSlabs();
  }, []);

  useEffect(() => {
    const fetchQRSettings = async () => {
      try {
        const { data } = await supabase
          .from('qr_settings')
          .select('qr_min_limit, qr_max_limit, bbps_max_limit, billavenue_max_limit, cspl_max_limit, daily_live_bbps_limit, daily_normal_bill_limit, is_fund_transfer_enabled, is_dmt_enabled, t_plus_one_limit, ds_min_fund_transfer_limit, md_min_fund_transfer_limit')
          .eq('id', 1)
          .single();
        if (data) {
          setQrMinLimit(Number(data.qr_min_limit) || 100);
          setQrMaxLimit(Number(data.qr_max_limit) || 100000);
          setBbpsMaxLimit(Number(data.bbps_max_limit) || 50000);
          setBillavenueMaxLimit(data.billavenue_max_limit !== undefined && data.billavenue_max_limit !== null ? Number(data.billavenue_max_limit) : 49999);
          setCsplMaxLimit(data.cspl_max_limit !== undefined && data.cspl_max_limit !== null ? Number(data.cspl_max_limit) : 49999);
          setDailyLiveBbpsLimit(Number(data.daily_live_bbps_limit) || 500000);
          setDailyNormalBillLimit(Number(data.daily_normal_bill_limit) || 500000);
          setTPlusOneLimit(data.t_plus_one_limit !== undefined && data.t_plus_one_limit !== null ? Number(data.t_plus_one_limit) : 0);
          setDsMinFundTransferLimit(Number(data.ds_min_fund_transfer_limit) || 0);
          setMdMinFundTransferLimit(Number(data.md_min_fund_transfer_limit) || 0);
          setIsFundTransferEnabled(data.is_fund_transfer_enabled !== false);
          setIsDmtEnabled(data.is_dmt_enabled !== false);
        }
      } catch (err) {
        console.error('Error fetching QR settings limits:', err);
      }
    };
    fetchQRSettings();
  }, []);

  const handleToggleFundTransfer = async () => {
    if (!isFullAdmin) return;
    setTogglingFundTransfer(true);
    const newValue = !isFundTransferEnabled;
    try {
      const { error } = await supabase
        .from('qr_settings')
        .update({ is_fund_transfer_enabled: newValue })
        .eq('id', 1);

      if (error) throw error;
      setIsFundTransferEnabled(newValue);
    } catch (err: any) {
      console.error('Error toggling fund transfer status:', err);
      alert('Failed to update fund transfer status');
    } finally {
      setTogglingFundTransfer(false);
    }
  };

  const handleToggleDmt = async () => {
    if (!isFullAdmin) return;
    setTogglingDmt(true);
    const newValue = !isDmtEnabled;
    try {
      const { error } = await supabase
        .from('qr_settings')
        .update({ is_dmt_enabled: newValue })
        .eq('id', 1);

      if (error) throw error;
      setIsDmtEnabled(newValue);
    } catch (err: any) {
      console.error('Error toggling DMT status:', err);
      alert('Failed to update DMT status');
    } finally {
      setTogglingDmt(false);
    }
  };

  const handleSaveLimits = async () => {
    setLimitsSaving(true);
    setLimitsSuccess(null);
    setLimitsError(null);
    try {
      const { error } = await supabase
        .from('qr_settings')
        .update({
          qr_min_limit: qrMinLimit,
          qr_max_limit: qrMaxLimit,
          bbps_max_limit: bbpsMaxLimit,
          billavenue_max_limit: billavenueMaxLimit,
          cspl_max_limit: csplMaxLimit,
          daily_live_bbps_limit: dailyLiveBbpsLimit,
          daily_normal_bill_limit: dailyNormalBillLimit,
          t_plus_one_limit: tPlusOneLimit,
          ds_min_fund_transfer_limit: dsMinFundTransferLimit,
          md_min_fund_transfer_limit: mdMinFundTransferLimit
        })
        .eq('id', 1);

      if (error) throw error;
      setLimitsSuccess('Payment limits updated successfully!');
      setTimeout(() => setLimitsSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error saving limits:', err);
      setLimitsError('Failed to update payment limits');
      setTimeout(() => setLimitsError(null), 3000);
    } finally {
      setLimitsSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const slabData = {
        min_amount: Number(formData.min_amount),
        max_amount: Number(formData.max_amount),
        charge_amount: Number(formData.charge_amount),
        is_percentage: formData.is_percentage,
      };

      if (editingSlab) {
        const { error } = await supabase
          .from('service_charge_slabs')
          .update(slabData)
          .eq('id', editingSlab.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('service_charge_slabs')
          .insert([slabData]);
        if (error) throw error;
      }

      setIsAdding(false);
      setEditingSlab(null);
      setFormData({
        min_amount: '',
        max_amount: '',
        charge_amount: '',
        is_percentage: false,
      });
      fetchSlabs();
    } catch (err) {
      console.error('Error saving slab:', err);
      setError('Failed to save service charge slab');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (slab: Slab) => {
    setEditingSlab(slab);
    setFormData({
      min_amount: slab.min_amount.toString(),
      max_amount: slab.max_amount.toString(),
      charge_amount: slab.charge_amount.toString(),
      is_percentage: slab.is_percentage,
    });
    setIsAdding(true);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setIsDeleting(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('service_charge_slabs')
        .delete()
        .eq('id', deleteConfirm);
      if (error) throw error;
      setSlabs(prev => prev.filter(s => s.id !== deleteConfirm));
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting slab:', err);
      setError('Failed to delete slab');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleStatus = async (slab: Slab) => {
    const newStatus = !slab.is_active;
    setSlabs(prev => prev.map(s => s.id === slab.id ? { ...s, is_active: newStatus } : s));

    try {
      const { error } = await supabase
        .from('service_charge_slabs')
        .update({ is_active: newStatus })
        .eq('id', slab.id);
      if (error) throw error;
    } catch (err) {
      console.error('Error toggling status:', err);
      fetchSlabs();
    }
  };

  // Fetch Nixasoft payout slabs and verification settings
  const fetchPayoutSlabs = async () => {
    try {
      setLoadingPayoutSlabs(true);
      const res = await fetch('/api/nixasoft-payout/admin/settings');
      const data = await res.json();
      if (data.success && data.settings) {
        if (data.settings.slabs) {
          setPayoutSlabs(data.settings.slabs);
        }
        if (data.settings.verification_charge !== undefined) {
          setVerificationCharge(Number(data.settings.verification_charge));
        }
        if (data.settings.is_verification_enabled !== undefined) {
          setIsVerificationEnabled(Boolean(data.settings.is_verification_enabled));
        }
      }

      // Fetch collected verification fees from payout_submissions
      try {
        const { data: verRows, error: verErr } = await supabase
          .from('payout_submissions')
          .select('charge_amount, status')
          .eq('bank_ref', 'VERIFICATION_CHARGE')
          .in('status', ['approved', 'success', 'successful']);

        if (!verErr && verRows) {
          const totalFees = verRows.reduce((sum, r) => sum + (Number(r.charge_amount) || 0), 0);
          setVerificationStats({
            totalCount: verRows.length,
            totalFees
          });
        }
      } catch (statsErr) {
        console.error('Error fetching verification stats:', statsErr);
      }
    } catch (err) {
      console.error('Error fetching payout slabs in ServiceChargeManagement:', err);
    } finally {
      setLoadingPayoutSlabs(false);
    }
  };

  const handleSaveVerificationSettings = async () => {
    try {
      setSavingVerificationSettings(true);
      setPayoutError(null);
      const res = await fetch('/api/nixasoft-payout/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verification_charge: Number(verificationCharge),
          is_verification_enabled: isVerificationEnabled
        })
      });
      const data = await res.json();
      if (data.success) {
        setPayoutSuccess('Bank Account Verification settings saved successfully!');
        setTimeout(() => setPayoutSuccess(null), 3500);
      } else {
        setPayoutError(data.message || 'Failed to save verification settings');
      }
    } catch (err: any) {
      setPayoutError(err.message || 'Error saving verification settings');
    } finally {
      setSavingVerificationSettings(false);
    }
  };

  useEffect(() => {
    fetchPayoutSlabs();
  }, []);

  const handleOpenAddPayoutSlab = () => {
    setEditingPayoutSlab(null);
    setPayoutSlabForm({
      min_amount: '',
      max_amount: '',
      charge_type: 'flat',
      charge_value: '',
      is_active: true
    });
    setPayoutError(null);
    setIsPayoutModalOpen(true);
  };

  const handleOpenEditPayoutSlab = (slab: PayoutSlab) => {
    setEditingPayoutSlab(slab);
    setPayoutSlabForm({
      min_amount: String(slab.min_amount),
      max_amount: String(slab.max_amount),
      charge_type: slab.charge_type,
      charge_value: String(slab.charge_value),
      is_active: slab.is_active
    });
    setPayoutError(null);
    setIsPayoutModalOpen(true);
  };

  const handleSavePayoutSlab = async (e: React.FormEvent) => {
    e.preventDefault();
    const min = Number(payoutSlabForm.min_amount);
    const max = Number(payoutSlabForm.max_amount);
    const val = Number(payoutSlabForm.charge_value);

    if (isNaN(min) || isNaN(max) || isNaN(val)) {
      setPayoutError('Please enter valid numeric amounts');
      return;
    }

    if (min >= max) {
      setPayoutError('Maximum amount must be greater than minimum amount');
      return;
    }

    try {
      setSavingPayoutSlab(true);
      setPayoutError(null);
      const url = editingPayoutSlab 
        ? `/api/nixasoft-payout/admin/slabs/${editingPayoutSlab.id}`
        : '/api/nixasoft-payout/admin/slabs';
      const method = editingPayoutSlab ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          min_amount: min,
          max_amount: max,
          charge_type: payoutSlabForm.charge_type,
          charge_value: val,
          is_active: payoutSlabForm.is_active
        })
      });
      const data = await res.json();
      if (data.success) {
        setPayoutSlabs(data.slabs || []);
        setIsPayoutModalOpen(false);
        setPayoutSuccess(editingPayoutSlab ? 'Payout slab updated successfully' : 'New payout slab added successfully');
        setTimeout(() => setPayoutSuccess(null), 3500);
      } else {
        setPayoutError(data.message || 'Failed to save payout slab');
      }
    } catch (err: any) {
      setPayoutError(err.message || 'Error saving payout slab');
    } finally {
      setSavingPayoutSlab(false);
    }
  };

  const handleDeletePayoutSlab = async () => {
    if (!payoutDeleteConfirm) return;
    try {
      setIsDeletingPayoutSlab(true);
      const res = await fetch(`/api/nixasoft-payout/admin/slabs/${payoutDeleteConfirm}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setPayoutSlabs(data.slabs || []);
        setPayoutDeleteConfirm(null);
        setPayoutSuccess('Payout slab deleted successfully');
        setTimeout(() => setPayoutSuccess(null), 3500);
      } else {
        setPayoutError(data.message || 'Failed to delete payout slab');
      }
    } catch (err: any) {
      setPayoutError(err.message || 'Error deleting payout slab');
    } finally {
      setIsDeletingPayoutSlab(false);
    }
  };

  const handleTogglePayoutSlab = async (slab: PayoutSlab) => {
    try {
      const res = await fetch(`/api/nixasoft-payout/admin/slabs/${slab.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !slab.is_active })
      });
      const data = await res.json();
      if (data.success) {
        setPayoutSlabs(data.slabs || []);
      }
    } catch (err) {
      console.error('Error toggling payout slab status:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Tab Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            {activeTab === 'service' ? 'Service Charge Slabs & Limits' : 'Dynamic Payout Charge Slabs'}
          </h2>
          <p className="text-slate-500 mt-1">
            {activeTab === 'service' 
              ? 'Configure service charge amounts based on transaction value ranges.'
              : 'Configure tier-based fees (e.g. ₹100-50,000 = ₹25) applied atomically during instant bank payouts.'}
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-2 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/60 shadow-inner shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab('service');
              setSearchParams({});
            }}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 ${
              activeTab === 'service'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers size={16} />
            Service Slabs & Limits
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {slabs.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('payout');
              setSearchParams({ tab: 'payout' });
            }}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 ${
              activeTab === 'payout'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Receipt size={16} />
            Payout Slabs (Dynamic)
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
              {payoutSlabs.length}
            </span>
          </button>
        </div>
      </div>

      {activeTab === 'service' && (
        <div className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-4">
            <div className="flex items-center flex-wrap gap-4">
          {isFullAdmin && (
            <div className="flex items-center gap-3 bg-white border border-slate-100 shadow-sm rounded-2xl px-4 py-2.5">
              <span className="text-sm font-extrabold text-slate-600">Fund Transfer:</span>
              <button
                type="button"
                onClick={handleToggleFundTransfer}
                disabled={togglingFundTransfer}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isFundTransferEnabled ? 'bg-emerald-500' : 'bg-slate-300'
                } ${togglingFundTransfer ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isFundTransferEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className={`text-xs font-black uppercase tracking-wider ${isFundTransferEnabled ? 'text-emerald-600' : 'text-slate-400'}`}>
                {isFundTransferEnabled ? 'On' : 'Off'}
              </span>
            </div>
          )}
          {isFullAdmin && (
            <div className="flex items-center gap-3 bg-white border border-slate-100 shadow-sm rounded-2xl px-4 py-2.5">
              <span className="text-sm font-extrabold text-slate-600">DMT (Money Transfer):</span>
              <button
                type="button"
                onClick={handleToggleDmt}
                disabled={togglingDmt}
                title={isDmtEnabled ? 'Click to Disable DMT in User Panel' : 'Click to Enable DMT in User Panel'}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isDmtEnabled ? 'bg-emerald-500' : 'bg-slate-300'
                } ${togglingDmt ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isDmtEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className={`text-xs font-black uppercase tracking-wider ${isDmtEnabled ? 'text-emerald-600' : 'text-slate-400'}`}>
                {isDmtEnabled ? 'On' : 'Off'}
              </span>
            </div>
          )}
          {isFullAdmin && (
            <button 
              onClick={() => {
                setIsAdding(true);
                setEditingSlab(null);
                setFormData({
                  min_amount: '',
                  max_amount: '',
                  charge_amount: '',
                  is_percentage: false,
                });
                setError(null);
              }}
              className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 active:scale-95"
            >
              <Plus size={20} />
              <span>Add New Slab</span>
            </button>
          )}
        </div>
      </div>

      {/* Payment Limits Card */}
      {isFullAdmin && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 shrink-0">
              <IndianRupee size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 leading-tight">Payment Limits</h3>
              <p className="text-xs text-slate-400 mt-0.5">Configure the minimum and maximum amount range that users can submit for payments.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4 items-end">
            <div className="space-y-1.5 w-full">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Min QR Limit (₹)</label>
              <input
                type="number"
                placeholder="e.g. 100"
                value={qrMinLimit || ''}
                onChange={(e) => setQrMinLimit(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              />
            </div>
            <div className="space-y-1.5 w-full">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Max QR Limit (₹)</label>
              <input
                type="number"
                placeholder="e.g. 200000"
                value={qrMaxLimit || ''}
                onChange={(e) => setQrMaxLimit(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              />
            </div>
            <div className="space-y-1.5 w-full">
              <label className="text-[10px] font-bold text-sky-600 uppercase tracking-widest ml-1 flex items-center gap-1">
                BillAvenue Max Limit (₹)
              </label>
              <input
                type="number"
                placeholder="e.g. 49999"
                value={billavenueMaxLimit || ''}
                onChange={(e) => setBillavenueMaxLimit(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-sky-50/50 border border-sky-200 rounded-xl text-sm font-bold text-sky-900 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all"
              />
            </div>
            <div className="space-y-1.5 w-full">
              <label className="text-[10px] font-bold text-purple-600 uppercase tracking-widest ml-1 flex items-center gap-1">
                CSPL Max Limit (₹)
              </label>
              <input
                type="number"
                placeholder="e.g. 49999"
                value={csplMaxLimit || ''}
                onChange={(e) => setCsplMaxLimit(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-purple-50/50 border border-purple-200 rounded-xl text-sm font-bold text-purple-900 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all"
              />
            </div>
            <div className="space-y-1.5 w-full">
              <label className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest ml-1 flex items-center gap-1">
                Live BBPS Max Limit (₹)
              </label>
              <input
                type="number"
                placeholder="e.g. 50000"
                value={bbpsMaxLimit || ''}
                onChange={(e) => setBbpsMaxLimit(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-indigo-50/50 border border-indigo-200 rounded-xl text-sm font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              />
            </div>
            <div className="space-y-1.5 w-full">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Daily Live BBPS Limit (₹)</label>
              <input
                type="number"
                placeholder="e.g. 500000"
                value={dailyLiveBbpsLimit || ''}
                onChange={(e) => setDailyLiveBbpsLimit(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              />
            </div>
            <div className="space-y-1.5 w-full">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Daily Normal Bill Limit (₹)</label>
              <input
                type="number"
                placeholder="e.g. 500000"
                value={dailyNormalBillLimit || ''}
                onChange={(e) => setDailyNormalBillLimit(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              />
            </div>
            <div className="space-y-1.5 w-full">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Daily T+1 Limit (₹)</label>
              <input
                type="number"
                placeholder="e.g. 2000000"
                value={tPlusOneLimit || ''}
                onChange={(e) => setTPlusOneLimit(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              />
            </div>
            <div className="space-y-1.5 w-full">
              <label className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest ml-1 flex items-center gap-1">
                DS Min Fund Transfer Limit (₹)
              </label>
              <input
                type="number"
                placeholder="e.g. 500"
                value={dsMinFundTransferLimit || ''}
                onChange={(e) => setDsMinFundTransferLimit(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-emerald-50/50 border border-emerald-200 rounded-xl text-sm font-bold text-emerald-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
              />
            </div>
            <div className="space-y-1.5 w-full">
              <label className="text-[10px] font-bold text-blue-600 uppercase tracking-widest ml-1 flex items-center gap-1">
                MD Min Fund Transfer Limit (₹)
              </label>
              <input
                type="number"
                placeholder="e.g. 1000"
                value={mdMinFundTransferLimit || ''}
                onChange={(e) => setMdMinFundTransferLimit(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-blue-50/50 border border-blue-200 rounded-xl text-sm font-bold text-blue-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleSaveLimits}
              disabled={limitsSaving}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-100 flex items-center gap-2 disabled:opacity-50 h-[42px] shrink-0 active:scale-95 cursor-pointer"
            >
              {limitsSaving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
              <span>Save Limits</span>
            </button>
          </div>

          {limitsSuccess && (
            <div className="text-xs font-bold text-emerald-600 flex items-center gap-1.5 animate-in fade-in slide-in-from-bottom-1">
              <CheckCircle2 size={14} />
              {limitsSuccess}
            </div>
          )}
          {limitsError && (
            <div className="text-xs font-bold text-rose-600 flex items-center gap-1.5 animate-in fade-in slide-in-from-bottom-1">
              <AlertCircle size={14} />
              {limitsError}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
          <LogoLoader size="md" className="mx-auto" />
        </div>
      ) : slabs.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
            <Receipt size={40} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">No Slabs Defined</h3>
          <p className="text-slate-500 max-w-sm mx-auto mb-8">
            You haven't configured any service charge slabs yet. Add your first slab to start calculating charges.
          </p>
          <button 
            onClick={() => setIsAdding(true)}
            className="text-indigo-600 font-bold hover:underline"
          >
            Add Slab Now
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {slabs.map((slab) => (
            <motion.div 
              layout
              key={slab.id}
              className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden group hover:shadow-md transition-all ${!slab.is_active ? 'opacity-75' : ''}`}
            >
              <div className="p-4 flex items-center justify-between gap-6">
                <div className="flex items-center gap-6 flex-1">
                  <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 shrink-0">
                    <Layers size={24} />
                  </div>
                  
                  <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-12 flex-1">
                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">From</p>
                        <p className="text-sm font-bold text-slate-900">₹{slab.min_amount.toLocaleString()}</p>
                      </div>
                      <ArrowRight size={16} className="text-slate-300 mt-4" />
                      <div className="text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">To</p>
                        <p className="text-sm font-bold text-slate-900">₹{slab.max_amount.toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="h-8 w-px bg-slate-100 hidden md:block" />

                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Service Charge</p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-lg font-bold text-indigo-600">
                          {slab.is_percentage ? `${slab.charge_amount}%` : `₹${slab.charge_amount.toLocaleString()}`}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                          {slab.is_percentage ? 'Percentage' : 'Flat Fee'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <button 
                    onClick={() => isFullAdmin && toggleStatus(slab)}
                    disabled={!isFullAdmin}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${slab.is_active ? 'bg-indigo-600' : 'bg-slate-200'} ${!isFullAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${slab.is_active ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>

                  {isFullAdmin && (
                    <div className="flex items-center gap-1 border-l border-slate-100 pl-4">
                      <button 
                        onClick={() => handleEdit(slab)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button 
                        onClick={() => setDeleteConfirm(slab.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )}

  {activeTab === 'payout' && (
    <div className="space-y-6">
      {payoutSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2 text-emerald-700 text-sm font-bold animate-in fade-in">
          <CheckCircle2 size={18} />
          {payoutSuccess}
        </div>
      )}
      {payoutError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-rose-700 text-sm font-bold animate-in fade-in">
          <AlertCircle size={18} />
          {payoutError}
        </div>
      )}

      {/* Bank Account Verification Settings Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              Bank Account Verification Settings (ખાતા ચકાસણી નિયંત્રણ)
              <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${
                isVerificationEnabled 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                {isVerificationEnabled ? 'ACTIVE (ON)' : 'DISABLED (OFF)'}
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Set dynamic verification fee debited from user wallet ONLY when a bank account is successfully verified via Nixasoft API
            </p>
          </div>

          {isFullAdmin && (
            <button
              onClick={handleSaveVerificationSettings}
              disabled={savingVerificationSettings}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-indigo-100 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {savingVerificationSettings ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              Save Verification Settings
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          {/* Verification Fee Input */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
              Verification Fee Per Success (₹)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
              <input
                type="number"
                min="0"
                step="0.5"
                value={verificationCharge}
                disabled={!isFullAdmin}
                onChange={(e) => setVerificationCharge(Number(e.target.value))}
                placeholder="3.00"
                className="w-full pl-8 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60"
              />
            </div>
            <p className="text-[11px] text-slate-400">
              User's wallet will be debited this exact amount only upon successful bank verification (Default: ₹3.00).
            </p>
          </div>

          {/* Toggle Service Active */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
            <div className="space-y-1 pr-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                Verification Service Status
              </span>
              <p className="text-[11px] text-slate-400">
                When enabled, users can verify bank accounts before initiating instant payouts.
              </p>
            </div>
            {isFullAdmin ? (
              <button
                type="button"
                onClick={() => setIsVerificationEnabled(!isVerificationEnabled)}
                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isVerificationEnabled ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isVerificationEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            ) : (
              <span className="text-xs font-bold text-slate-500">View Only</span>
            )}
          </div>
        </div>

        {/* Verification Revenue & Usage Summary Banner */}
        <div className="p-4 bg-gradient-to-r from-indigo-50/70 via-purple-50/40 to-slate-50 border border-indigo-100/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-900 block">
                Total Verification Revenue Collected (કુલ ચાર્જ સંગ્રહ)
              </span>
              <p className="text-xs text-slate-500">
                Total revenue from successfully verified bank accounts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <div className="text-right">
              <div className="text-xl font-black text-indigo-950">
                ₹{verificationStats.totalFees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs font-semibold text-slate-500">
                Total Collected Fees
              </div>
            </div>

            <div className="h-8 w-px bg-indigo-200/60 hidden sm:block" />

            <div className="text-right">
              <div className="text-xl font-black text-slate-800">
                {verificationStats.totalCount}
              </div>
              <div className="text-xs font-semibold text-slate-500">
                Verified Accounts
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Charge Slabs Table */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
              Dynamic Charge Slabs
              <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full border border-indigo-100">
                {payoutSlabs.length} Slabs
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure tier-based fees (e.g. ₹100-50,000 = ₹25, ₹50,001-1,00,000 = ₹50) applied atomically during bank payouts
            </p>
          </div>

          {isFullAdmin && (
            <button
              onClick={handleOpenAddPayoutSlab}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-indigo-100 transition-all active:scale-95"
            >
              <Plus size={16} />
              Add New Slab
            </button>
          )}
        </div>

        {loadingPayoutSlabs ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
            <LogoLoader size="md" className="mx-auto" />
            <p className="text-xs font-bold">Loading payout slabs...</p>
          </div>
        ) : payoutSlabs.length === 0 ? (
          <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl space-y-3">
            <Layers className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">No Payout Slabs Configured</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Click the "Add New Slab" button above to create tier-based payout charges.
            </p>
            {isFullAdmin && (
              <button
                onClick={handleOpenAddPayoutSlab}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
              >
                Create First Slab
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="pb-3 px-3">Range (From - To)</th>
                  <th className="pb-3 px-3">Charge Type</th>
                  <th className="pb-3 px-3">Charge Amount</th>
                  <th className="pb-3 px-3 text-center">Status</th>
                  {isFullAdmin && <th className="pb-3 px-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {payoutSlabs.map((slab) => (
                  <tr key={slab.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-4 px-3 font-bold text-slate-900">
                      <span className="text-indigo-600">₹{slab.min_amount.toLocaleString()}</span>
                      <span className="text-slate-400 mx-1.5">→</span>
                      <span>₹{slab.max_amount.toLocaleString()}</span>
                    </td>
                    <td className="py-4 px-3">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase ${
                        slab.charge_type === 'percentage'
                          ? 'bg-purple-50 text-purple-700 border border-purple-100'
                          : 'bg-blue-50 text-blue-700 border border-blue-100'
                      }`}>
                        {slab.charge_type === 'percentage' ? 'Percentage (%)' : 'Flat Fee (₹)'}
                      </span>
                    </td>
                    <td className="py-4 px-3 font-black text-rose-600">
                      {slab.charge_type === 'percentage' ? `${slab.charge_value}%` : `₹${slab.charge_value}`}
                    </td>
                    <td className="py-4 px-3 text-center">
                      <button
                        onClick={() => isFullAdmin && handleTogglePayoutSlab(slab)}
                        disabled={!isFullAdmin}
                        className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase transition-all ${
                          slab.is_active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        } ${!isFullAdmin ? 'cursor-default' : 'cursor-pointer hover:shadow-sm'}`}
                      >
                        {slab.is_active ? 'Active' : 'Disabled'}
                      </button>
                    </td>
                    {isFullAdmin && (
                      <td className="py-4 px-3 text-right space-x-2">
                        <button
                          onClick={() => handleOpenEditPayoutSlab(slab)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Edit Slab"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => setPayoutDeleteConfirm(slab.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete Slab"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )}

  {/* Service Slab Add/Edit Modal */}
  <AnimatePresence>
    {isAdding && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100"
        >
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-slate-900">{editingSlab ? 'Edit Slab' : 'New Service Slab'}</h3>
            <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <X size={20} className="text-slate-400" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 text-sm font-bold">
                <AlertCircle size={18} />
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Min Amount (₹)</label>
                <input 
                  required
                  type="number" 
                  value={formData.min_amount}
                  onChange={e => setFormData({...formData, min_amount: e.target.value})}
                  placeholder="0"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Max Amount (₹)</label>
                <input 
                  required
                  type="number" 
                  value={formData.max_amount}
                  onChange={e => setFormData({...formData, max_amount: e.target.value})}
                  placeholder="1000"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Charge Amount</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  {formData.is_percentage ? <Percent size={16} /> : <IndianRupee size={16} />}
                </div>
                <input 
                  required
                  type="number" 
                  step="0.01"
                  value={formData.charge_amount}
                  onChange={e => setFormData({...formData, charge_amount: e.target.value})}
                  placeholder="0.00"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div>
                <p className="text-sm font-bold text-slate-900">Charge Type</p>
                <p className="text-xs text-slate-500">Is this a percentage or flat fee?</p>
              </div>
              <div className="flex bg-white p-1 rounded-xl border border-slate-200">
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, is_percentage: false})}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${!formData.is_percentage ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Flat
                </button>
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, is_percentage: true})}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${formData.is_percentage ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  %
                </button>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button 
                type="button"
                onClick={() => setIsAdding(false)}
                className="flex-1 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={saving}
                className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                {editingSlab ? 'Update Slab' : 'Save Slab'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    )}
  </AnimatePresence>

  {/* Service Slab Delete Confirmation Modal */}
  <AnimatePresence>
    {deleteConfirm && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100"
        >
          <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mx-auto mb-6">
            <AlertCircle size={32} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 text-center mb-2">Delete Slab</h3>
          <p className="text-slate-500 text-center mb-8">
            Are you sure you want to delete this service charge slab? This action cannot be undone.
          </p>
          {error && (
            <div className="mb-6 p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-bold text-center">
              {error}
            </div>
          )}
          <div className="flex gap-4">
            <button 
              onClick={() => { setDeleteConfirm(null); setError(null); }}
              className="flex-1 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-rose-200 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isDeleting ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
              {isDeleting ? 'Deleting...' : 'Yes, Delete'}
            </button>
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>

  {/* Payout Slab Add/Edit Modal */}
  <AnimatePresence>
    {isPayoutModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 space-y-6"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-indigo-600" />
              <h3 className="text-xl font-bold text-slate-900">
                {editingPayoutSlab ? 'Edit Payout Slab' : 'Add New Payout Slab'}
              </h3>
            </div>
            <button
              onClick={() => setIsPayoutModalOpen(false)}
              className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSavePayoutSlab} className="space-y-4">
            {payoutError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2">
                <AlertCircle size={15} />
                {payoutError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Min Amount (₹)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={payoutSlabForm.min_amount}
                  onChange={(e) => setPayoutSlabForm({ ...payoutSlabForm, min_amount: e.target.value })}
                  placeholder="e.g. 100"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Max Amount (₹)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={payoutSlabForm.max_amount}
                  onChange={(e) => setPayoutSlabForm({ ...payoutSlabForm, max_amount: e.target.value })}
                  placeholder="e.g. 50000"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:bg-white focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Charge Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPayoutSlabForm({ ...payoutSlabForm, charge_type: 'flat' })}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                    payoutSlabForm.charge_type === 'flat'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Flat Fee (₹)
                </button>
                <button
                  type="button"
                  onClick={() => setPayoutSlabForm({ ...payoutSlabForm, charge_type: 'percentage' })}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                    payoutSlabForm.charge_type === 'percentage'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Percentage (%)
                </button>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                {payoutSlabForm.charge_type === 'percentage' ? 'Charge Percentage (%)' : 'Charge Amount (₹)'}
              </label>
              <input
                type="number"
                step="0.01"
                required
                min="0"
                value={payoutSlabForm.charge_value}
                onChange={(e) => setPayoutSlabForm({ ...payoutSlabForm, charge_value: e.target.value })}
                placeholder={payoutSlabForm.charge_type === 'percentage' ? 'e.g. 0.5' : 'e.g. 25'}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:bg-white focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-700">Slab Status</span>
              <button
                type="button"
                onClick={() => setPayoutSlabForm({ ...payoutSlabForm, is_active: !payoutSlabForm.is_active })}
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase transition-all ${
                  payoutSlabForm.is_active
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-300 text-slate-700'
                }`}
              >
                {payoutSlabForm.is_active ? 'Active' : 'Disabled'}
              </button>
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setIsPayoutModalOpen(false)}
                className="flex-1 py-3 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingPayoutSlab}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {savingPayoutSlab ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {editingPayoutSlab ? 'Update Slab' : 'Save Slab'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    )}
  </AnimatePresence>

  {/* Payout Slab Delete Confirmation Modal */}
  <AnimatePresence>
    {payoutDeleteConfirm && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100 space-y-4"
        >
          <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mx-auto">
            <AlertCircle size={32} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 text-center">Delete Payout Slab</h3>
          <p className="text-slate-500 text-center text-xs leading-relaxed">
            Are you sure you want to delete this payout charge slab? Transactions in this range will fall back to default fees.
          </p>
          <div className="flex gap-3 pt-2">
            <button 
              onClick={() => setPayoutDeleteConfirm(null)}
              className="flex-1 py-3 rounded-xl font-bold text-xs text-slate-500 hover:bg-slate-100 transition-colors border border-slate-200"
            >
              Cancel
            </button>
            <button 
              onClick={handleDeletePayoutSlab}
              disabled={isDeletingPayoutSlab}
              className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs transition-all shadow-lg shadow-rose-200 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isDeletingPayoutSlab ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
              {isDeletingPayoutSlab ? 'Deleting...' : 'Yes, Delete'}
            </button>
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
</div>
);
}
