import React, { useState, useEffect } from 'react';
import { Building2, Plus, Edit2, Trash2, CheckCircle2, XCircle, Copy, Check, CreditCard, Landmark, QrCode } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import Modal from '../../components/Modal';

export interface AdminBankAccount {
  id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  ifsc_code: string;
  branch_name?: string;
  upi_id?: string;
  is_active: boolean;
  created_at?: string;
}

export default function B2BAdminBankAccounts() {
  const [accounts, setAccounts] = useState<AdminBankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AdminBankAccount | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    bank_name: '',
    account_name: '',
    account_number: '',
    ifsc_code: '',
    branch_name: '',
    upi_id: '',
    is_active: true
  });

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('b2b_admin_bank_accounts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error && error.code !== 'PGRST205') {
        console.error('Error fetching admin bank accounts:', error);
      }
      setAccounts(data || []);
    } catch (e) {
      console.error('Fetch admin bank accounts exception:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingAccount(null);
    setFormData({
      bank_name: '',
      account_name: '',
      account_number: '',
      ifsc_code: '',
      branch_name: '',
      upi_id: '',
      is_active: true
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (acc: AdminBankAccount) => {
    setEditingAccount(acc);
    setFormData({
      bank_name: acc.bank_name || '',
      account_name: acc.account_name || '',
      account_number: acc.account_number || '',
      ifsc_code: acc.ifsc_code || '',
      branch_name: acc.branch_name || '',
      upi_id: acc.upi_id || '',
      is_active: acc.is_active ?? true
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.bank_name || !formData.account_name || !formData.account_number || !formData.ifsc_code) {
      alert('Please fill in all mandatory fields (Bank Name, Account Holder Name, Account Number, IFSC Code)');
      return;
    }

    setSaving(true);
    try {
      if (editingAccount) {
        const { error } = await supabase
          .from('b2b_admin_bank_accounts')
          .update({
            bank_name: formData.bank_name.trim(),
            account_name: formData.account_name.trim(),
            account_number: formData.account_number.trim(),
            ifsc_code: formData.ifsc_code.trim().toUpperCase(),
            branch_name: formData.branch_name.trim() || null,
            upi_id: formData.upi_id.trim() || null,
            is_active: formData.is_active,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingAccount.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('b2b_admin_bank_accounts')
          .insert({
            bank_name: formData.bank_name.trim(),
            account_name: formData.account_name.trim(),
            account_number: formData.account_number.trim(),
            ifsc_code: formData.ifsc_code.trim().toUpperCase(),
            branch_name: formData.branch_name.trim() || null,
            upi_id: formData.upi_id.trim() || null,
            is_active: formData.is_active
          });

        if (error) throw error;
      }

      setIsModalOpen(false);
      fetchAccounts();
    } catch (err: any) {
      console.error('Error saving bank account:', err);
      alert('Error saving bank account: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (acc: AdminBankAccount) => {
    try {
      const { error } = await supabase
        .from('b2b_admin_bank_accounts')
        .update({ is_active: !acc.is_active })
        .eq('id', acc.id);

      if (error) throw error;
      fetchAccounts();
    } catch (err: any) {
      console.error('Error toggling bank account active status:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this bank account?')) return;
    try {
      const { error } = await supabase
        .from('b2b_admin_bank_accounts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchAccounts();
    } catch (err: any) {
      console.error('Error deleting bank account:', err);
      alert('Failed to delete bank account: ' + (err.message || 'Unknown error'));
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
            <Landmark className="h-6 w-6 text-indigo-400" />
            Company Bank Accounts
          </h2>
          <p className="text-slate-400 text-sm">
            Manage your official bank accounts. Agents will select these bank accounts when submitting fund requests.
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Add Bank Account</span>
        </button>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="bg-slate-800/80 rounded-2xl border border-slate-700/80 p-12 flex justify-center items-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="bg-slate-800/80 rounded-2xl border border-slate-700/80 p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto text-indigo-400">
            <Building2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white">No Bank Accounts Found</h3>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            You haven't added any company bank accounts yet. Add bank accounts so agents can select them when submitting fund requests.
          </p>
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Add First Bank Account</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              className={`bg-slate-800/90 border rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between transition-all ${
                acc.is_active ? 'border-slate-700 hover:border-indigo-500/50' : 'border-rose-500/20 opacity-60'
              }`}
            >
              <div className="space-y-4">
                {/* Card Top */}
                <div className="flex items-start justify-between gap-3 border-b border-slate-700/70 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white text-base">{acc.bank_name}</h3>
                      {acc.is_active ? (
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase">
                          ACTIVE
                        </span>
                      ) : (
                        <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase">
                          INACTIVE
                        </span>
                      )}
                    </div>
                    {acc.branch_name && (
                      <p className="text-xs text-slate-400 mt-0.5">{acc.branch_name}</p>
                    )}
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                    <Landmark className="w-5 h-5" />
                  </div>
                </div>

                {/* Account Details */}
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Account Holder</span>
                    <span className="text-white font-semibold text-sm">{acc.account_name}</span>
                  </div>

                  <div className="flex items-center justify-between bg-slate-900/80 p-2.5 rounded-xl border border-slate-700/50">
                    <div>
                      <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Account Number</span>
                      <span className="text-emerald-400 font-mono font-bold text-sm tracking-wide">{acc.account_number}</span>
                    </div>
                    <button
                      onClick={() => copyToClipboard(acc.account_number, `acc_${acc.id}`)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                      title="Copy Account Number"
                    >
                      {copiedId === `acc_${acc.id}` ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="flex items-center justify-between bg-slate-900/80 p-2.5 rounded-xl border border-slate-700/50">
                    <div>
                      <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">IFSC Code</span>
                      <span className="text-indigo-300 font-mono font-bold text-xs tracking-wider">{acc.ifsc_code}</span>
                    </div>
                    <button
                      onClick={() => copyToClipboard(acc.ifsc_code, `ifsc_${acc.id}`)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                      title="Copy IFSC Code"
                    >
                      {copiedId === `ifsc_${acc.id}` ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>

                  {acc.upi_id && (
                    <div className="flex items-center justify-between bg-indigo-950/30 p-2.5 rounded-xl border border-indigo-500/20">
                      <div>
                        <span className="text-indigo-300 block text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                          <QrCode className="w-3 h-3 text-indigo-400" /> UPI ID
                        </span>
                        <span className="text-amber-300 font-mono font-bold text-xs">{acc.upi_id}</span>
                      </div>
                      <button
                        onClick={() => copyToClipboard(acc.upi_id!, `upi_${acc.id}`)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        title="Copy UPI ID"
                      >
                        {copiedId === `upi_${acc.id}` ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-4 mt-4 border-t border-slate-700/70">
                <button
                  onClick={() => handleToggleActive(acc)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                    acc.is_active
                      ? 'bg-amber-500/10 text-amber-300 border-amber-500/20 hover:bg-amber-500/20'
                      : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20 hover:bg-emerald-500/20'
                  }`}
                >
                  {acc.is_active ? 'Deactivate' : 'Activate'}
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEditModal(acc)}
                    className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
                    title="Edit Bank Account"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(acc.id)}
                    className="p-2 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                    title="Delete Bank Account"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal for Add / Edit Bank Account */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingAccount ? "Edit Company Bank Account" : "Add New Company Bank Account"}
        >
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Bank Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. ICICI Bank, State Bank of India"
                value={formData.bank_name}
                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-3.5 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Account Holder Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Rajwadi Enterprises Pvt Ltd"
                value={formData.account_name}
                onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-3.5 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Account Number <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 50200012345678"
                  value={formData.account_number}
                  onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-3.5 text-sm text-white font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  IFSC Code <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ICIC0005020"
                  value={formData.ifsc_code}
                  onChange={(e) => setFormData({ ...formData, ifsc_code: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-3.5 text-sm text-white font-mono uppercase focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Branch Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rajkot Main Branch"
                  value={formData.branch_name}
                  onChange={(e) => setFormData({ ...formData, branch_name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-3.5 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  UPI ID (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. rajwadi@icici"
                  value={formData.upi_id}
                  onChange={(e) => setFormData({ ...formData, upi_id: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-3.5 text-sm text-white font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="is_active_checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded bg-slate-900 border-slate-700 focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="is_active_checkbox" className="text-sm font-medium text-slate-300 cursor-pointer">
                Active for Fund Requests Selection
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-700/80">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-400 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                {saving && <LoadingSpinner size="sm" />}
                <span>{editingAccount ? 'Update Bank Account' : 'Add Bank Account'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
